# 手写缓存框架（Node.js）

## 目标

实现一个简化版缓存框架，支持：
1. TTL 过期
2. LRU / LFU / FIFO 淘汰策略
3. 事件监听
4. 统计监控
5. 并发安全（单进程）
6. Write-Through / Write-Behind 适配

## 实现

```javascript
// cache-framework.js

const { EventEmitter } = require('events');

class Cache extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || null; // ms, null = 永不过期
    this.policy = options.policy || 'lru'; // lru | lfu | fifo
    this.cleanupInterval = options.cleanupInterval || 60000;
    
    this.store = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
    
    // LFU 频率记录
    this.freqMap = new Map();
    
    // 自动清理
    this.cleanupTimer = null;
    if (this.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
    }
  }

  // ========== 核心 API ==========

  get(key) {
    const entry = this.store.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.emit('miss', { key });
      return undefined;
    }
    
    if (this._isExpired(entry)) {
      this.store.delete(key);
      this.freqMap.delete(key);
      this.stats.expirations++;
      this.emit('expire', { key, value: entry.value });
      this.stats.misses++;
      return undefined;
    }
    
    // 更新访问记录
    entry.lastAccess = Date.now();
    entry.accessCount = (entry.accessCount || 0) + 1;
    this.freqMap.set(key, entry.accessCount);
    
    this.stats.hits++;
    this.emit('hit', { key, value: entry.value });
    return entry.value;
  }

  set(key, value, ttl = this.defaultTTL) {
    // 如果已满且是新的 key，先淘汰
    if (!this.store.has(key) && this.store.size >= this.maxSize) {
      this._evict();
    }
    
    const now = Date.now();
    const entry = {
      key,
      value,
      created: now,
      lastAccess: now,
      accessCount: 1,
      expireAt: ttl ? now + ttl : null,
    };
    
    this.store.set(key, entry);
    this.freqMap.set(key, 1);
    
    this.emit('set', { key, value });
    return this;
  }

  getOrSet(key, factory, ttl = this.defaultTTL) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    
    const value = factory(key);
    this.set(key, value, ttl);
    return value;
  }

  async getOrSetAsync(key, factory, ttl = this.defaultTTL) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    
    const value = await factory(key);
    this.set(key, value, ttl);
    return value;
  }

  delete(key) {
    const entry = this.store.get(key);
    if (entry) {
      this.store.delete(key);
      this.freqMap.delete(key);
      this.emit('delete', { key, value: entry.value });
      return true;
    }
    return false;
  }

  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this._isExpired(entry)) {
      this.store.delete(key);
      this.freqMap.delete(key);
      return false;
    }
    return true;
  }

  clear() {
    this.store.clear();
    this.freqMap.clear();
    this.emit('clear', {});
  }

  keys() {
    const result = [];
    for (const [key, entry] of this.store) {
      if (!this._isExpired(entry)) {
        result.push(key);
      }
    }
    return result;
  }

  // ========== 批量操作 ==========

  mget(keys) {
    const result = {};
    for (const key of keys) {
      result[key] = this.get(key);
    }
    return result;
  }

  mset(entries, ttl = this.defaultTTL) {
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value, ttl);
    }
  }

  // ========== 过期管理 ==========

  expire(key, ttl) {
    const entry = this.store.get(key);
    if (entry) {
      entry.expireAt = Date.now() + ttl;
      return true;
    }
    return false;
  }

  ttl(key) {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (!entry.expireAt) return -1;
    const remaining = entry.expireAt - Date.now();
    return remaining > 0 ? remaining : -2;
  }

  cleanup() {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store) {
      if (entry.expireAt && now > entry.expireAt) {
        this.store.delete(key);
        this.freqMap.delete(key);
        this.stats.expirations++;
        this.emit('expire', { key, value: entry.value });
        count++;
      }
    }
    return count;
  }

  // ========== 淘汰策略 ==========

  _evict() {
    if (this.store.size === 0) return;
    
    let evictKey = null;
    
    switch (this.policy) {
      case 'lru': {
        let oldest = Infinity;
        for (const [key, entry] of this.store) {
          if (entry.lastAccess < oldest) {
            oldest = entry.lastAccess;
            evictKey = key;
          }
        }
        break;
      }
      case 'lfu': {
        let minFreq = Infinity;
        for (const [key, entry] of this.store) {
          const freq = this.freqMap.get(key) || 0;
          if (freq < minFreq) {
            minFreq = freq;
            evictKey = key;
          }
        }
        break;
      }
      case 'fifo': {
        let oldest = Infinity;
        for (const [key, entry] of this.store) {
          if (entry.created < oldest) {
            oldest = entry.created;
            evictKey = key;
          }
        }
        break;
      }
    }
    
    if (evictKey !== null) {
      const entry = this.store.get(evictKey);
      this.store.delete(evictKey);
      this.freqMap.delete(evictKey);
      this.stats.evictions++;
      this.emit('evict', { key: evictKey, value: entry.value });
    }
  }

  _isExpired(entry) {
    if (!entry.expireAt) return false;
    return Date.now() > entry.expireAt;
  }

  // ========== 统计 ==========

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
    };
  }

  // ========== 装饰器模式 ==========

  wrap(fn, keyFn, ttl) {
    return async (...args) => {
      const key = keyFn ? keyFn(...args) : JSON.stringify(args);
      return this.getOrSetAsync(key, () => fn(...args), ttl);
    };
  }

  // ========== 关闭 ==========

  close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// ========== 多级缓存适配器 ==========

class MultiLevelCache {
  constructor(l1, l2) {
    this.l1 = l1; // 本地缓存
    this.l2 = l2; // Redis / 远程缓存
  }

  async get(key) {
    // L1
    let value = this.l1.get(key);
    if (value !== undefined) return value;
    
    // L2
    if (this.l2) {
      value = await this.l2.get(key);
      if (value !== undefined) {
        this.l1.set(key, value);
        return value;
      }
    }
    
    return undefined;
  }

  async set(key, value, l1TTL, l2TTL) {
    this.l1.set(key, value, l1TTL);
    if (this.l2) {
      await this.l2.set(key, value, l2TTL);
    }
  }

  async delete(key) {
    this.l1.delete(key);
    if (this.l2) {
      await this.l2.delete(key);
    }
  }
}

// ========== 使用 ==========

const cache = new Cache({
  maxSize: 100,
  defaultTTL: 5000,
  policy: 'lru',
});

cache.on('hit', ({ key }) => console.log('HIT', key));
cache.on('miss', ({ key }) => console.log('MISS', key));
cache.on('evict', ({ key }) => console.log('EVICT', key));

// 基础使用
cache.set('user:1', { name: 'Alice' }, 10000);
const user = cache.get('user:1');

// 懒加载
const data = cache.getOrSet('config', () => loadConfig(), 60000);

// 异步懒加载
const profile = await cache.getOrSetAsync('profile:1', async () => {
  return await fetchUser(1);
}, 30000);

// 函数包装（缓存装饰器）
const getUserCached = cache.wrap(
  async (id) => fetchUser(id),
  (id) => `user:${id}`,
  60000
);
const user2 = await getUserCached(2);

console.log(cache.getStats());
cache.close();

module.exports = { Cache, MultiLevelCache };
```
