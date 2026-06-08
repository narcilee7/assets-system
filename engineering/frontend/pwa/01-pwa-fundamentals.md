# PWA 基础

## 1. Web App Manifest

```json
{
  "name": "My App",
  "short_name": "MyApp",
  "description": "A progressive web app",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#3b82f6",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/home.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "categories": ["productivity", "utilities"],
  "lang": "en"
}
```

```html
<!-- 引入 Manifest -->
<link rel="manifest" href="/manifest.json" />

<!-- 主题色 -->
<meta name="theme-color" content="#3b82f6" />

<!-- iOS Safari -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="MyApp" />
<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

<!-- Windows -->
<meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
<meta name="msapplication-TileColor" content="#3b82f6" />
```

| display 值 | 行为 |
|-----------|------|
| `fullscreen` | 全屏，无浏览器 UI |
| `standalone` | 独立应用，像原生 app |
| `minimal-ui` | 最小浏览器控件 |
| `browser` | 普通浏览器标签页 |

## 2. Service Worker 注册

```javascript
// main.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('SW registered:', registration.scope);

      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新 SW 已安装，等待激活
            showUpdateNotification(newWorker);
          }
        });
      });
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  });
}

// 检查更新
function checkForUpdates() {
  navigator.serviceWorker.ready.then((registration) => {
    registration.update();
  });
}

// 每小时检查一次
setInterval(checkForUpdates, 60 * 60 * 1000);
```

## 3. 安装体验

```javascript
// 监听安装提示
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();  // 阻止自动弹出
  deferredPrompt = e;

  // 显示自定义安装按钮
  showInstallButton();
});

async function installApp() {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    console.log('User installed the app');
    hideInstallButton();
  }

  deferredPrompt = null;
}

// 检测是否已安装
window.addEventListener('appinstalled', () => {
  console.log('App was installed');
  hideInstallButton();
  deferredPrompt = null;
});

// 检测是否以 PWA 模式运行
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}
```

## 4. Workbox

```javascript
// sw.js（使用 Workbox）
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// 预缓存构建产物（由 workbox-build 注入）
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// 缓存策略
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 天
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'assets',
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 }),
    ],
  })
);

// 离线回退
const handler = async (options) => {
  const response = await StaleWhileRevalidate.handle(options);
  return response || caches.match('/offline.html');
};

registerRoute(new NavigationRoute(handler));

// 跳过等待
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

```javascript
// vite.config.ts（Workbox 集成）
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.example\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'My App',
        short_name: 'MyApp',
        theme_color: '#3b82f6',
        // ...
      },
    }),
  ],
});
```
