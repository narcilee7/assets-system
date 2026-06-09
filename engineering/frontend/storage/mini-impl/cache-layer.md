# 手写多级缓存层

## 目标

实现一个简化版多级缓存层，支持：
1. L1（Memory）+ L2（IndexedDB）+ L3（Server）架构
2. 缓存策略（LRU / LFU / TTL）
3. 缓存失效与刷新
4. 一致性保障

## 实现

```javascript
// cache-layer.js

// ========== 缓存策略 ==========

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    // 移到最近使用
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // 淘汰最久未使用
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  has(key) {
    return this.cache.has(key);
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  clear() {
    this.cache.clear();
  }
}

class LFUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.values = new Map();
    this.frequencies = new Map();
    this.minFreq = 0;
  }

  get(key) {
    if (!this.values.has(key)) return undefined;
    this.incrementFreq(key);
    return this.values.get(key).value;
  }

  set(key, value) {
    if (this.values.has(key)) {
      this.values.get(key).value = value;
      this.incrementFreq(key);
      return;
    }

    if (this.values.size >= this.capacity) {
      this.evictLFU();
    }

    this.values.set(key, { value, freq: 1 });
    this.frequencies.set(1, (this.frequencies.get(1) || new Set()).add(key));
    this.minFreq = 1;
  }

  incrementFreq(key) {
    const node = this.values.get(key);
    const oldFreq = node.freq;
    node.freq++;

    this.frequencies.get(oldFreq).delete(key);
    if (this.frequencies.get(oldFreq).size === 0 && oldFreq === this.minFreq) {
      this.minFreq++;
    }

    if (!this.frequencies.has(node.freq)) {
      this.frequencies.set(node.freq, new Set());
    }
    this.frequencies.get(node.freq).add(key);
  }

  evictLFU() {
    const keys = this.frequencies.get(this.minFreq);
    const keyToDelete = keys.values().next().value;
    keys.delete(keyToDelete);
    this.values.delete(keyToDelete);
  }

  delete(key) {
    if (!this.values.has(key)) return false;
    const node = this.values.get(key);
    this.frequencies.get(node.freq).delete(key);
    this.values.delete(key);
    return true;
  }

  clear() {
    this.values.clear();
    this.frequencies.clear();
    this.minFreq = 0;
  }
}

// ========== 多级缓存 ==========

class MultiLevelCache {
  constructor(options = {}) {
    this.l1 = new LRUCache(options.l1Size || 100);     // Memory
    this.l2 = null;                                     // IndexedDB (lazy init)
    this.l2Enabled = options.l2Enabled !== false;
    this.l2Prefix = options.l2Prefix || 'cache:';
    this.ttl = options.ttl || null;
    this.staleWhileRevalidate = options.staleWhileRevalidate || false;
    this.refreshQueue = new Set();
  }

  async initL2() {
    if (this.l2 || !this.l2Enabled) return;
    this.l2 = await this.openIndexedDB();
  }

  async openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('cache-layer', 1);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ========== 读取 ==========

  async get(key, fetcher) {
    // L1 命中
    const l1Value = this.l1.get(key);
    if (l1Value !== undefined) {
      if (!this.isStale(l1Value)) {
        return l1Value.data;
      }
      // Stale While Revalidate
      if (this.staleWhileRevalidate && fetcher && !this.refreshQueue.has(key)) {
        this.refreshQueue.add(key);
        this.refresh(key, fetcher).finally(() => this.refreshQueue.delete(key));
      }
      return l1Value.data;
    }

    // L2 命中
    await this.initL2();
    if (this.l2) {
      const l2Value = await this.getFromL2(key);
      if (l2Value !== null) {
        if (!this.isStale(l2Value)) {
          // 回填 L1
          this.l1.set(key, l2Value);
          return l2Value.data;
        }
        // Stale While Revalidate
        if (this.staleWhileRevalidate && fetcher) {
          this.l1.set(key, l2Value);  // 先返回 stale
          this.refresh(key, fetcher);
          return l2Value.data;
        }
      }
    }

    // L3：调用 fetcher
    if (fetcher) {
      return this.fetchAndCache(key, fetcher);
    }

    return null;
  }

  async getFromL2(key) {
    return new Promise((resolve) => {
      const tx = this.l2.transaction('cache', 'readonly');
      const store = tx.objectStore('cache');
      const request = store.get(this.l2Prefix + key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  // ========== 写入 ==========

  async set(key, data, options = {}) {
    const entry = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.ttl,
    };

    // L1
    this.l1.set(key, entry);

    // L2
    await this.initL2();
    if (this.l2) {
      await new Promise((resolve, reject) => {
        const tx = this.l2.transaction('cache', 'readwrite');
        const store = tx.objectStore('cache');
        const request = store.put({
          key: this.l2Prefix + key,
          ...entry,
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  // ========== 刷新 ==========

  async refresh(key, fetcher) {
    try {
      const data = await fetcher();
      await this.set(key, data);
    } catch (error) {
      console.warn(`Refresh failed for ${key}:`, error);
    }
  }

  async fetchAndCache(key, fetcher) {
    const data = await fetcher();
    await this.set(key, data);
    return data;
  }

  // ========== 失效 ==========

  invalidate(key) {
    this.l1.delete(key);
    if (this.l2) {
      const tx = this.l2.transaction('cache', 'readwrite');
      tx.objectStore('cache').delete(this.l2Prefix + key);
    }
  }

  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.l1.keys()) {
      if (regex.test(key)) {
        this.l1.delete(key);
      }
    }
    // L2 清理需要遍历，简化版省略
  }

  invalidateAll() {
    this.l1.clear();
    if (this.l2) {
      const tx = this.l2.transaction('cache', 'readwrite');
      tx.objectStore('cache').clear();
    }
  }

  // ========== 工具方法 ==========

  isStale(entry) {
    if (!entry || !entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  // ========== 统计 ==========

  getStats() {
    return {
      l1Size: this.l1.cache.size,
      l1Capacity: this.l1.capacity,
    };
  }
}

// ========== 使用 ==========

const cache = new MultiLevelCache({
  l1Size: 100,
  l2Enabled: true,
  ttl: 5 * 60 * 1000,  // 5 分钟
  staleWhileRevalidate: true,
});

// 带缓存的数据获取
async function getUser(userId) {
  return cache.get(`user:${userId}`, async () => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  });
}

// 第一次：fetch → cache
const user1 = await getUser('123');

// 第二次：L1 命中
const user2 = await getUser('123');

// 手动失效
cache.invalidate('user:123');

module.exports = { MultiLevelCache, LRUCache, LFUCache };
```
