# SW 缓存策略

## 1. 五种核心策略

```javascript
// 策略 1：Cache First（缓存优先）
// 适用：静态资源（JS/CSS/图片）
async function cacheFirst(request) {
  const cache = await caches.open('static-v1');
  const cached = await cache.match(request);
  if (cached) return cached;

  const networkResponse = await fetch(request);
  cache.put(request, networkResponse.clone());
  return networkResponse;
}

// 策略 2：Network First（网络优先）
// 适用：API 请求、实时数据
async function networkFirst(request) {
  const cache = await caches.open('api-v1');
  try {
    const networkResponse = await fetch(request);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Network and cache both failed');
  }
}

// 策略 3：Stale While Revalidate（先返回缓存，后台更新）
// 适用：大部分场景（平衡速度和新鲜度）
async function staleWhileRevalidate(request) {
  const cache = await caches.open('dynamic-v1');
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    cache.put(request, networkResponse.clone());
    return networkResponse;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// 策略 4：Network Only（仅网络）
// 适用： Analytics、非敏感实时数据
async function networkOnly(request) {
  return fetch(request);
}

// 策略 5：Cache Only（仅缓存）
// 适用：离线页面、预缓存内容
async function cacheOnly(request) {
  const cache = await caches.open('precache-v1');
  const cached = await cache.match(request);
  if (!cached) throw new Error('Not in cache');
  return cached;
}
```

## 2. 路由匹配

```javascript
// 基于 URL 模式匹配
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 静态资源
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // JS/CSS
  if (['script', 'style'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 页面导航
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // 默认
  event.respondWith(staleWhileRevalidate(request));
});
```

## 3. 缓存清理

```javascript
// 版本化缓存清理
const CACHE_VERSION = 'v2';

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.includes(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );
    })
  );
});

// 带大小限制的缓存
class SizeLimitedCache {
  constructor(cacheName, maxSize = 50 * 1024 * 1024) {
    this.cacheName = cacheName;
    this.maxSize = maxSize;
  }

  async add(request, response) {
    const cache = await caches.open(this.cacheName);
    await cache.put(request, response);
    await this._enforceLimit();
  }

  async _enforceLimit() {
    const cache = await caches.open(this.cacheName);
    const requests = await cache.keys();
    let totalSize = 0;
    const sizes = [];

    for (const request of requests) {
      const response = await cache.match(request);
      const blob = await response.blob();
      totalSize += blob.size;
      sizes.push({ request, size: blob.size, timestamp: Date.now() });
    }

    if (totalSize > this.maxSize) {
      // LRU：删除最旧的
      sizes.sort((a, b) => a.timestamp - b.timestamp);
      let toDelete = totalSize - this.maxSize;

      for (const item of sizes) {
        if (toDelete <= 0) break;
        await cache.delete(item.request);
        toDelete -= item.size;
      }
    }
  }
}
```
