# 缓存失效策略

## 1. 文件名哈希（最可靠）

```
构建前：app.js
构建后：app.a3f7c2.js

内容变化 → 哈希变化 → 新文件名 → 浏览器视为新资源
旧文件仍缓存 → 长期有效 → 无缓存失效问题
```

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
  },
});

// webpack.config.js
module.exports = {
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
  },
};
```

## 2. 查询参数版本号

```html
<!-- 不推荐：CDN 可能忽略查询参数 -->
<script src="/app.js?v=2"></script>

<!-- 稍好：路径版本号 -->
<script src="/v2/app.js"></script>

<!-- 最佳：文件名哈希 -->
<script src="/app.a3f7c2.js"></script>
```

## 3. Service Worker 更新策略

```javascript
// 方案 1：构建时注入版本，SW 自动更新
const CACHE_NAME = `app-${__BUILD_HASH__}`;

// 方案 2：Manifest 版本检查
async function checkForUpdate() {
  const [cachedManifest, networkManifest] = await Promise.all([
    caches.match('/manifest.json'),
    fetch('/manifest.json'),
  ]);

  const cached = cachedManifest ? await cachedManifest.json() : null;
  const latest = await networkManifest.json();

  if (cached?.version !== latest.version) {
    // 有新版本，通知用户
    showUpdateNotification(() => {
      navigator.serviceWorker.controller?.postMessage('SKIP_WAITING');
    });
  }
}

// 方案 3：App Shell 模式（PWA 推荐）
// 仅缓存 HTML 骨架，数据通过 API 获取
const APP_SHELL = [
  '/index.html',
  '/shell.js',
  '/shell.css',
];
```

## 4. CDN 刷新策略

```bash
# CloudFront 刷新
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/index.html" "/api/*"

# 阿里云 CDN 刷新
aliyun cdn RefreshObjectCaches \
  --ObjectPath https://example.com/index.html \
  --ObjectType File

# 最佳实践：
# 1. 静态资源用文件名哈希 → 永不刷新
# 2. 只刷新 HTML 入口和 API
# 3. 使用版本化路径 /v1/、/v2/ → 无需刷新
```

## 5. 优雅降级

```javascript
// 当缓存失效导致 404 时，回退到 index.html（SPA）
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() => {
          // 如果是导航请求，返回 index.html（SPA 路由）
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        })
      );
    })
  );
});
```
