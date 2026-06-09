# Service Worker 缓存

## 1. Service Worker 生命周期

```
注册 (register) → 安装 (install) → 激活 (activate) → 控制页面 (controlled)
                       ↓                  ↓
                  缓存资源            清理旧缓存
```

```javascript
// sw.js
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/app.css',
  '/icon.png',
];

// Install：缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 跳过 waiting，立即激活
  self.skipWaiting();
});

// Activate：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});
```

## 2. 缓存策略

```javascript
// 1. Cache First（优先缓存，适合静态资源）
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

// 2. Network First（优先网络，适合实时数据）
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    return cache.match(request);
  }
}

// 3. Stale While Revalidate（先返回缓存，后台更新，最佳平衡）
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    cache.put(request, response.clone());
    return response;
  });

  return cached || fetchPromise;
}

// 4. Cache Only（仅缓存，完全离线）
async function cacheOnly(request) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request);
}

// 5. Network Only（仅网络，不缓存）
async function networkOnly(request) {
  return fetch(request);
}
```

## 3. Fetch 事件路由

```javascript
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 静态资源：Cache First
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API 请求：Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 图片：Stale While Revalidate
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 默认：Network First
  event.respondWith(networkFirst(request));
});
```

## 4. 更新策略

```javascript
// 方案 1：每次构建更新 CACHE_NAME（最简单）
// webpack/vite 构建时注入版本号
const CACHE_NAME = `app-${BUILD_HASH}`;

// 方案 2：检测更新并提示用户
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 页面中检测更新
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload();  // 新版本激活后刷新
});

// 定期检查更新
setInterval(() => {
  navigator.serviceWorker.ready.then((registration) => {
    registration.update();
  });
}, 60 * 60 * 1000);  // 每小时检查
```
