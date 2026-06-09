# 手写分层存储管理器

## 目标

实现一个简化版分层存储管理器，支持：
1. 多层存储（Memory → IndexedDB → Server）
2. 自动回填（L1 miss → L2 → L3）
3. TTL 过期管理
4. 写入策略（Write-Through / Write-Behind）
5. 事件通知

## 实现

```javascript
// storage-manager.js

class StorageManager {
  constructor(options = {}) {
    this.layers = [];
    this.ttlMap = new Map();
    this.listeners = new Map();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    this.defaultTTL = options.defaultTTL || null;
    this.writeStrategy = options.writeStrategy || 'through'; // through | behind
  }

  // ========== 层注册 ==========

  addLayer(layer, options = {}) {
    this.layers.push({
      name: layer.name || `layer-${this.layers.length}`,
      storage: layer,
      priority: options.priority ?? this.layers.length,
      writable: options.writable !== false,
    });
    this.layers.sort((a, b) => a.priority - b.priority);
    return this;
  }

  // ========== 读取 ==========

  async get(key) {
    // 检查 TTL
    if (this.isExpired(key)) {
      await this.delete(key);
      return null;
    }

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      try {
        const value = await layer.storage.get(key);
        if (value !== null && value !== undefined) {
          this.stats.hits++;
          // 回填到上层
          await this.backfill(key, value, i);
          return this.deserialize(value);
        }
      } catch (error) {
        console.warn(`Layer ${layer.name} read error:`, error);
      }
    }

    this.stats.misses++;
    return null;
  }

  async getMany(keys) {
    const results = {};
    for (const key of keys) {
      results[key] = await this.get(key);
    }
    return results;
  }

  // ========== 写入 ==========

  async set(key, value, options = {}) {
    const serialized = this.serialize(value);
    const ttl = options.ttl ?? this.defaultTTL;

    if (ttl) {
      this.ttlMap.set(key, Date.now() + ttl);
    }

    if (this.writeStrategy === 'through') {
      // Write-Through：写入所有可写层
      for (const layer of this.layers) {
        if (layer.writable) {
          try {
            await layer.storage.set(key, serialized);
          } catch (error) {
            console.warn(`Layer ${layer.name} write error:`, error);
          }
        }
      }
    } else {
      // Write-Behind：只写入最上层，异步刷到下层
      const topLayer = this.layers.find((l) => l.writable);
      if (topLayer) {
        await topLayer.storage.set(key, serialized);
      }
      this.scheduleWriteBehind(key, serialized);
    }

    this.stats.sets++;
    this.emit('set', { key, value });
    return this;
  }

  async setMany(entries, options = {}) {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value, options);
    }
    return this;
  }

  // ========== 删除 ==========

  async delete(key) {
    this.ttlMap.delete(key);

    for (const layer of this.layers) {
      if (layer.writable) {
        try {
          await layer.storage.delete(key);
        } catch (error) {
          console.warn(`Layer ${layer.name} delete error:`, error);
        }
      }
    }

    this.stats.deletes++;
    this.emit('delete', { key });
    return this;
  }

  async clear() {
    this.ttlMap.clear();

    for (const layer of this.layers) {
      if (layer.writable) {
        try {
          await layer.storage.clear();
        } catch (error) {
          console.warn(`Layer ${layer.name} clear error:`, error);
        }
      }
    }

    this.emit('clear', {});
    return this;
  }

  // ========== 回填 ==========

  async backfill(key, value, foundAtLayer) {
    for (let i = 0; i < foundAtLayer; i++) {
      const layer = this.layers[i];
      if (layer.writable) {
        try {
          await layer.storage.set(key, value);
        } catch (error) {
          // 上层写入失败不阻塞
        }
      }
    }
  }

  // ========== Write-Behind ==========

  scheduleWriteBehind(key, value) {
    // 简化版：延迟 1 秒批量写入
    if (this._writeBehindTimer) {
      clearTimeout(this._writeBehindTimer);
    }

    this._pendingWrites = this._pendingWrites || new Map();
    this._pendingWrites.set(key, value);

    this._writeBehindTimer = setTimeout(() => {
      this.flushPendingWrites();
    }, 1000);
  }

  async flushPendingWrites() {
    if (!this._pendingWrites || this._pendingWrites.size === 0) return;

    const writes = new Map(this._pendingWrites);
    this._pendingWrites.clear();

    for (const [key, value] of writes) {
      for (let i = 1; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (layer.writable) {
          try {
            await layer.storage.set(key, value);
          } catch (error) {
            console.warn(`Write-behind to ${layer.name} failed:`, error);
          }
        }
      }
    }
  }

  // ========== TTL 管理 ==========

  isExpired(key) {
    const expiry = this.ttlMap.get(key);
    if (!expiry) return false;
    return Date.now() > expiry;
  }

  async cleanupExpired() {
    const now = Date.now();
    const expired = [];

    for (const [key, expiry] of this.ttlMap) {
      if (now > expiry) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      await this.delete(key);
    }

    return expired.length;
  }

  startTTLCleanup(interval = 60000) {
    this._ttlTimer = setInterval(() => this.cleanupExpired(), interval);
    return () => clearInterval(this._ttlTimer);
  }

  // ========== 序列化 ==========

  serialize(value) {
    if (typeof value === 'string') return { __type: 'string', data: value };
    if (typeof value === 'number') return { __type: 'number', data: value };
    if (typeof value === 'boolean') return { __type: 'boolean', data: value };
    if (value === null) return { __type: 'null', data: null };
    return { __type: 'json', data: JSON.stringify(value) };
  }

  deserialize(stored) {
    if (!stored || typeof stored !== 'object') return stored;
    switch (stored.__type) {
      case 'string': return stored.data;
      case 'number': return stored.data;
      case 'boolean': return stored.data;
      case 'null': return null;
      case 'json': return JSON.parse(stored.data);
      default: return stored;
    }
  }

  // ========== 事件系统 ==========

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event).delete(handler);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error('Storage event handler error:', error);
      }
    });
  }

  // ========== 统计 ==========

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      layerCount: this.layers.length,
    };
  }
}

// ========== 内置存储层 ==========

class MemoryStorage {
  constructor() {
    this.name = 'memory';
    this.data = new Map();
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async set(key, value) {
    this.data.set(key, value);
  }

  async delete(key) {
    this.data.delete(key);
  }

  async clear() {
    this.data.clear();
  }

  async keys() {
    return Array.from(this.data.keys());
  }
}

class LocalStorageLayer {
  constructor(prefix = '') {
    this.name = 'localStorage';
    this.prefix = prefix;
  }

  _key(key) {
    return this.prefix + key;
  }

  async get(key) {
    const raw = localStorage.getItem(this._key(key));
    return raw ? JSON.parse(raw) : null;
  }

  async set(key, value) {
    localStorage.setItem(this._key(key), JSON.stringify(value));
  }

  async delete(key) {
    localStorage.removeItem(this._key(key));
  }

  async clear() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    }
  }

  async keys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        keys.push(key.slice(this.prefix.length));
      }
    }
    return keys;
  }
}

class IndexedDBLayer {
  constructor(dbName = 'storage-manager', storeName = 'data') {
    this.name = 'indexedDB';
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
  }

  async init() {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(key) {
    await this.init();
    return this._transaction('readonly', (store) => store.get(key));
  }

  async set(key, value) {
    await this.init();
    return this._transaction('readwrite', (store) => store.put({ key, value }));
  }

  async delete(key) {
    await this.init();
    return this._transaction('readwrite', (store) => store.delete(key));
  }

  async clear() {
    await this.init();
    return this._transaction('readwrite', (store) => store.clear());
  }

  async keys() {
    await this.init();
    return this._transaction('readonly', (store) => store.getAllKeys());
  }

  _transaction(mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      const request = fn(store);
      request.onsuccess = () => resolve(request.result?.value || request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// ========== 使用 ==========

const manager = new StorageManager({ defaultTTL: 60000 });

manager
  .addLayer(new MemoryStorage(), { priority: 0 })
  .addLayer(new LocalStorageLayer('app:'), { priority: 1 })
  .addLayer(new IndexedDBLayer('my-app'), { priority: 2 });

await manager.set('user', { name: 'Alice' }, { ttl: 30000 });
const user = await manager.get('user');  // 先查 Memory，miss 则查 localStorage，再 miss 查 IndexedDB

console.log(manager.getStats());  // { hits: 0, misses: 3, sets: 1, deletes: 0, hitRate: 0 }

module.exports = { StorageManager, MemoryStorage, LocalStorageLayer, IndexedDBLayer };
```
