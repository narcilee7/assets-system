# 缓存策略

## 1. HTTP 缓存

```
浏览器请求资源
    │
    ├── 有 Service Worker？ → SW 拦截处理
    │
    ├── Cache-Control: no-store → 不缓存，直接请求
    │
    ├── Cache-Control: no-cache → 必须 revalidate
    │
    ├── Expires / max-age 未过期？ → 使用缓存（200 from cache）
    │
    └── 过期了？
          ├── ETag 匹配？ → 304 Not Modified
          └── 不匹配？ → 200 + 新资源
```

```
Cache-Control 指令：
├─ public        : 任何缓存都可存储
├─ private       : 仅浏览器缓存
├─ no-cache      : 必须 revalidate
├─ no-store      : 完全不缓存
├─ max-age=3600  : 缓存 1 小时
├─ s-maxage=3600 : CDN 缓存 1 小时
├─ immutable     : 内容永不变（hash 文件名）
└─ stale-while-revalidate=60 : 过期后 60s 内仍可用（后台刷新）
```

```nginx
# Nginx 配置
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ~* \.(html)$ {
  add_header Cache-Control "no-cache";
}
```

## 2. Service Worker 缓存

```javascript
// sw.js
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css',
];

// 安装时缓存静态资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      // 缓存命中 → 返回缓存
      if (response) return response;

      // 缓存未命中 → 网络请求
      return fetch(e.request).then((networkResponse) => {
        // 缓存新资源
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, clone);
        });
        return networkResponse;
      });
    })
  );
});
```

## 3. 缓存策略模式

| 策略 | 描述 | 适用 |
|------|------|------|
| **Cache First** | 先读缓存，无缓存再网络 | 静态资源（JS/CSS/图片） |
| **Network First** | 先网络，失败回退缓存 | API 请求、HTML |
| **Stale While Revalidate** | 先返回缓存，后台更新 | 非关键数据 |
| **Network Only** | 只用网络 | 实时数据 |
| **Cache Only** | 只用缓存 | 离线应用 |
