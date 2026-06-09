# 手写 Service Worker 生命周期管理器

## 目标

实现一个简化版 SW 管理器，支持：
1. 注册与更新检测
2. 生命周期事件处理（install/activate/fetch）
3. 多版本缓存管理
4. 消息通信

## 实现

### 主线程：SW 管理器

```javascript
// sw-manager.js

class ServiceWorkerManager {
  constructor(options = {}) {
    this.scope = options.scope || '/';
    this.swUrl = options.swUrl || '/sw.js';
    this.onUpdate = options.onUpdate || (() => {});
    this.onInstall = options.onInstall || (() => {});
    this.onError = options.onError || console.error;
  }

  async register() {
    if (!('serviceWorker' in navigator)) {
      this.onError(new Error('Service Worker not supported'));
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register(this.swUrl, {
        scope: this.scope,
        updateViaCache: 'imports', // 从缓存检查更新
      });

      this._handleRegistration(registration);
      this._setupUpdateChecks(registration);

      return registration;
    } catch (error) {
      this.onError(error);
      return null;
    }
  }

  _handleRegistration(registration) {
    // 检查当前状态
    if (registration.installing) {
      this._trackWorker(registration.installing, 'installing');
    }
    if (registration.waiting) {
      this._trackWorker(registration.waiting, 'waiting');
    }
    if (registration.active) {
      this._trackWorker(registration.active, 'active');
    }

    // 监听新 worker 安装
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      this._trackWorker(newWorker, 'updatefound');
    });
  }

  _trackWorker(worker, state) {
    worker.addEventListener('statechange', () => {
      console.log(`SW state: ${worker.state} (was ${state})`);

      switch (worker.state) {
        case 'installed':
          if (navigator.serviceWorker.controller) {
            // 更新可用
            this.onUpdate(worker);
          } else {
            // 首次安装
            this.onInstall(worker);
          }
          break;
        case 'activated':
          // 新 SW 已激活
          break;
        case 'redundant':
          // 被取代
          break;
      }
    });
  }

  // 定期检查更新
  _setupUpdateChecks(registration) {
    // 页面可见时检查
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update();
      }
    });

    // 定时检查（每 30 分钟）
    setInterval(() => {
      registration.update();
    }, 30 * 60 * 1000);
  }

  // 立即激活等待中的 SW
  async skipWaiting() {
    if (!navigator.serviceWorker.controller) return;

    const registration = await navigator.serviceWorker.ready;
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  // 向 SW 发送消息
  async postMessage(message) {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage(message);
    }
  }

  // 注销 SW
  async unregister() {
    const registration = await navigator.serviceWorker.ready;
    return registration.unregister();
  }

  // 检查当前是否由 SW 控制
  isControlled() {
    return !!navigator.serviceWorker.controller;
  }
}

// ========== SW 脚本 ==========

// sw.js
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// 预缓存列表（构建时注入）
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/app.js',
  '/app.css',
];

// Install：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      self.skipWaiting();  // 立即激活
    })
  );
});

// Activate：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('static-') || name.startsWith('dynamic-');
          })
          .filter((name) => !name.includes(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      self.clients.claim();  // 立即控制所有客户端
    })
  );
});

// Fetch：拦截请求
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 跳过非 GET 请求
  if (request.method !== 'GET') return;

  // 导航请求
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  // 静态资源：Cache First
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API：Network First
  if (isAPI(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他：Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// 策略实现
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Network and cache both failed');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// 工具函数
function isStaticAsset(request) {
  return ['style', 'script', 'image', 'font'].includes(request.destination);
}

function isAPI(request) {
  return new URL(request.url).pathname.startsWith('/api/');
}

// 消息处理
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_CACHE_SIZE') {
    caches.keys().then((names) => {
      event.ports[0].postMessage({ cacheNames: names });
    });
  }
});

// ========== 使用 ==========

const swManager = new ServiceWorkerManager({
  swUrl: '/sw.js',
  scope: '/',
  onUpdate: (worker) => {
    showUpdateBanner(() => {
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  },
});

swManager.register();

module.exports = { ServiceWorkerManager };
```
