# 手写 Service Worker 缓存管理器

## 目标

实现一个简化版 SW 缓存管理器，支持：
1. 安装时预缓存指定资源
2. 运行时动态缓存（按策略）
3. 激活时清理过期缓存
4. 提供缓存统计信息

## 实现

```javascript
// sw-cache-manager.js
class CacheManager {
  constructor(options = {}) {
    this.cachePrefix = options.cachePrefix || 'app';
    this.currentVersion = options.version || 'v1';
    this.cacheName = `${this.cachePrefix}-${this.currentVersion}`;
    this.preCacheList = options.preCache || [];
    this.strategy = options.strategy || 'staleWhileRevalidate';
    this.maxAge = options.maxAge || 7 * 24 * 60 * 60 * 1000; // 7天
  }

  // 预缓存（install 阶段调用）
  async preCache() {
    const cache = await caches.open(this.cacheName);
    const results = await Promise.allSettled(
      this.preCacheList.map((url) =>
        cache.add(url).catch((err) => {
          console.warn(`[CacheManager] Pre-cache failed: ${url}`, err);
          throw err;
        })
      )
    );

    const success = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`[CacheManager] Pre-cached ${success}/${this.preCacheList.length}`);
  }

  // 清理旧缓存（activate 阶段调用）
  async cleanOldCaches() {
    const allCacheNames = await caches.keys();
    const oldCaches = allCacheNames.filter((name) => {
      return name.startsWith(this.cachePrefix) && name !== this.cacheName;
    });

    await Promise.all(oldCaches.map((name) => caches.delete(name)));
    console.log(`[CacheManager] Cleaned ${oldCaches.length} old caches`);
  }

  // 获取缓存策略
  async fetchWithStrategy(request) {
    switch (this.strategy) {
      case 'cacheFirst':
        return this._cacheFirst(request);
      case 'networkFirst':
        return this._networkFirst(request);
      case 'staleWhileRevalidate':
        return this._staleWhileRevalidate(request);
      case 'cacheOnly':
        return this._cacheOnly(request);
      default:
        return this._staleWhileRevalidate(request);
    }
  }

  async _cacheFirst(request) {
    const cache = await caches.open(this.cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }

  async _networkFirst(request) {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(this.cacheName);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch {
      const cache = await caches.open(this.cacheName);
      return cache.match(request);
    }
  }

  async _staleWhileRevalidate(request) {
    const cache = await caches.open(this.cacheName);
    const cached = await cache.match(request);

    const updateCache = fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => null);

    return cached || updateCache;
  }

  async _cacheOnly(request) {
    const cache = await caches.open(this.cacheName);
    return cache.match(request);
  }

  // 缓存统计
  async getStats() {
    const cache = await caches.open(this.cacheName);
    const requests = await cache.keys();
    let totalSize = 0;

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }

    return {
      cacheName: this.cacheName,
      itemCount: requests.length,
      totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
    };
  }
}

// 在 Service Worker 中使用
const manager = new CacheManager({
  version: 'v2',
  preCache: ['/', '/index.html', '/app.js', '/app.css'],
  strategy: 'staleWhileRevalidate',
});

self.addEventListener('install', (event) => {
  event.waitUntil(manager.preCache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(manager.cleanOldCaches());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(manager.fetchWithStrategy(event.request));
});
```
