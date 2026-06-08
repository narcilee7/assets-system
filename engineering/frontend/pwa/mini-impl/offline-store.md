# 手写离线存储管理器

## 目标

实现一个简化版离线存储管理器，支持：
1. 多层存储（Memory → IndexedDB → Cache API）
2. 离线队列（请求排队，恢复后自动重试）
3. 数据同步策略

## 实现

```javascript
// offline-store.js

class OfflineStore {
  constructor(dbName = 'offline-store', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.memory = new Map();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 存储离线数据
        if (!db.objectStoreNames.contains('data')) {
          const dataStore = db.createObjectStore('data', { keyPath: 'key' });
          dataStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 存储离线请求队列
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 存储同步元数据
        if (!db.objectStoreNames.contains('sync')) {
          db.createObjectStore('sync', { keyPath: 'key' });
        }
      };
    });
  }

  // ========== 数据存储 ==========

  async set(key, value, options = {}) {
    const data = {
      key,
      value,
      timestamp: Date.now(),
      ttl: options.ttl || null,
    };

    // 内存缓存
    this.memory.set(key, data);

    // IndexedDB
    await this._dbWrite('data', data);

    // 如果支持 Cache API，同时缓存
    if (options.cacheAPI && 'caches' in self) {
      await this._cacheWrite(key, value);
    }
  }

  async get(key) {
    // 1. 检查内存
    const mem = this.memory.get(key);
    if (mem) {
      if (mem.ttl && Date.now() > mem.timestamp + mem.ttl) {
        this.memory.delete(key);
        await this.delete(key);
        return null;
      }
      return mem.value;
    }

    // 2. 检查 IndexedDB
    const dbData = await this._dbRead('data', key);
    if (dbData) {
      if (dbData.ttl && Date.now() > dbData.timestamp + dbData.ttl) {
        await this.delete(key);
        return null;
      }
      // 回填内存
      this.memory.set(key, dbData);
      return dbData.value;
    }

    return null;
  }

  async delete(key) {
    this.memory.delete(key);
    await this._dbDelete('data', key);
    await this._cacheDelete(key);
  }

  async clear() {
    this.memory.clear();
    await this._dbClear('data');
  }

  // ========== 离线队列 ==========

  async enqueue(request) {
    const item = {
      url: request.url,
      method: request.method || 'GET',
      headers: Array.from(new Headers(request.headers).entries()),
      body: request.body,
      status: 'pending',
      retries: 0,
      maxRetries: request.maxRetries || 3,
      timestamp: Date.now(),
    };

    const id = await this._dbAdd('queue', item);
    return id;
  }

  async processQueue(processor) {
    const pending = await this._dbGetAll('queue', 'status', 'pending');

    for (const item of pending) {
      try {
        await processor(item);
        await this._dbDelete('queue', item.id);
      } catch (error) {
        if (item.retries < item.maxRetries) {
          await this._dbUpdate('queue', item.id, {
            retries: item.retries + 1,
            lastError: error.message,
          });
        } else {
          await this._dbUpdate('queue', item.id, {
            status: 'failed',
            lastError: error.message,
          });
        }
      }
    }
  }

  async getFailedItems() {
    return this._dbGetAll('queue', 'status', 'failed');
  }

  // ========== 同步元数据 ==========

  async setSyncMeta(key, meta) {
    await this._dbWrite('sync', { key, ...meta, updatedAt: Date.now() });
  }

  async getSyncMeta(key) {
    return this._dbRead('sync', key);
  }

  // ========== IndexedDB 底层 ==========

  _transaction(storeName, mode = 'readonly') {
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  _dbWrite(storeName, data) {
    return new Promise((resolve, reject) => {
      const request = this._transaction(storeName, 'readwrite').put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  _dbRead(storeName, key) {
    return new Promise((resolve, reject) => {
      const request = this._transaction(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  _dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      const request = this._transaction(storeName, 'readwrite').delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  _dbAdd(storeName, data) {
    return new Promise((resolve, reject) => {
      const request = this._transaction(storeName, 'readwrite').add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  _dbGetAll(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const store = this._transaction(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  _dbUpdate(storeName, key, updates) {
    return new Promise((resolve, reject) => {
      const store = this._transaction(storeName, 'readwrite');
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        const data = { ...getReq.result, ...updates };
        const putReq = store.put(data);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
    });
  }

  _dbClear(storeName) {
    return new Promise((resolve, reject) => {
      const request = this._transaction(storeName, 'readwrite').clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ========== Cache API ==========

  async _cacheWrite(key, value) {
    try {
      const cache = await caches.open(this.dbName);
      const response = new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json' },
      });
      await cache.put(key, response);
    } catch (e) {
      // Cache API 不可用则忽略
    }
  }

  async _cacheDelete(key) {
    try {
      const cache = await caches.open(this.dbName);
      await cache.delete(key);
    } catch (e) {
      // ignore
    }
  }
}

// ========== 使用 ==========

const store = new OfflineStore('my-app');
await store.init();

// 存储数据
await store.set('user:123', { name: 'Alice' }, { ttl: 60000 });

// 读取
const user = await store.get('user:123');

// 离线队列
await store.enqueue({
  url: '/api/messages',
  method: 'POST',
  body: JSON.stringify({ text: 'Hello' }),
});

// 恢复后处理队列
window.addEventListener('online', () => {
  store.processQueue(async (item) => {
    await fetch(item.url, {
      method: item.method,
      body: item.body,
      headers: Object.fromEntries(item.headers),
    });
  });
});

module.exports = { OfflineStore };
```
