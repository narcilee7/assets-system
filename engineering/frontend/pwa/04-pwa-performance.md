# PWA 性能

## 1. PRPL 模式

```
PRPL = Push, Render, Pre-cache, Lazy-load

1. Push（推送）
   ├── HTTP/2 Server Push（已废弃）
   ├── 103 Early Hints
   └── Link rel=preload

2. Render（渲染）
   ├── 首屏关键路径优化
   ├── 骨架屏
   └── 渐进式渲染

3. Pre-cache（预缓存）
   ├── Service Worker 预缓存 Shell
   └── 构建时确定缓存列表

4. Lazy-load（懒加载）
   ├── 路由级代码分割
   ├── 组件级懒加载
   └── 图片/视频懒加载
```

```html
<!-- 关键资源预加载 -->
<link rel="preload" href="/app.js" as="script">
<link rel="preload" href="/critical.css" as="style">
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

<!-- DNS 预解析 -->
<link rel="dns-prefetch" href="https://api.example.com">

<!-- 预连接 -->
<link rel="preconnect" href="https://cdn.example.com" crossorigin>

<!-- 103 Early Hints -->
<!-- 服务器先发送： -->
<!-- HTTP/1.1 103 Early Hints -->
<!-- Link: </style.css>; rel=preload; as=style -->
<!-- Link: </app.js>; rel=preload; as=script -->
```

## 2. App Shell 架构

```
App Shell = 最小化的 HTML/CSS/JS，用于即时渲染 UI 骨架

第一次访问：
  下载 Shell → 渲染骨架 → 下载内容 → 填充内容

后续访问：
  从缓存读取 Shell → 即时渲染骨架 → 从缓存/网络获取内容 → 填充

Shell 包含：
  ├── 布局框架（Header/Sidebar/Footer）
  ├── 全局样式
  ├── 路由逻辑
  └── 加载指示器

内容区域：
  └── 动态加载的页面内容
```

```javascript
// 构建时生成 App Shell
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        shell: './shell.html',  // App Shell
      },
    },
  },
});
```

## 3. 更新策略

```javascript
// 用户可控的更新策略

// 1. 自动更新（静默）
// SW 安装完成后立即激活
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. 用户确认更新
// 检测到新版本时提示用户
let newWorker = null;

navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload();  // 新 SW 激活后刷新
});

function showUpdateNotification(worker) {
  const toast = document.createElement('div');
  toast.innerHTML = `
    <div style="position:fixed;bottom:20px;right:20px;background:#333;color:#fff;padding:16px;border-radius:8px;">
      New version available!
      <button id="update-btn">Update Now</button>
    </div>
  `;
  document.body.appendChild(toast);

  document.getElementById('update-btn').addEventListener('click', () => {
    worker.postMessage('SKIP_WAITING');
  });
}

// 3. 延迟更新（等待用户关闭所有标签页）
// 默认行为：新的 SW 等待旧的释放
// 使用 skipWaiting() 可以强制激活
```

## 4. 性能指标

```javascript
// PWA 性能监控

// 1. Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(sendToAnalytics);
getLCP(sendToAnalytics);

// 2. Service Worker 指标
navigator.serviceWorker.ready.then((registration) => {
  // SW 控制时间
  const swControlledTime = performance.now();
  console.log('SW ready after:', swControlledTime, 'ms');
});

// 3. 缓存命中率
async function getCacheStats() {
  const cache = await caches.open('dynamic-v1');
  const requests = await cache.keys();
  return {
    cachedItems: requests.length,
    cacheSize: await calculateCacheSize(cache),
  };
}

// 4. Lighthouse PWA 审计
// npx lighthouse https://example.com --preset=desktop --only-categories=pwa
```
