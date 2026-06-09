# 关键渲染路径优化

## 1. 优化加载顺序

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 1. 关键元信息（字符集、viewport） -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">

  <!-- 2. 预连接关键域名 -->
  <link rel="preconnect" href="https://cdn.example.com">

  <!-- 3. 内联关键 CSS（< 14KB，一个 TCP 往返） -->
  <style>
    /* 首屏必需的样式 */
    body { margin: 0; font-family: sans-serif; }
    .hero { min-height: 100vh; display: flex; align-items: center; }
    .nav { position: fixed; top: 0; width: 100%; }
  </style>

  <!-- 4. 预加载关键资源 -->
  <link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
  <link rel="preload" href="/images/hero.webp" as="image" fetchpriority="high">

  <!-- 5. 异步加载非关键 CSS -->
  <link rel="preload" href="/css/non-critical.css" as="style" onload="this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/css/non-critical.css"></noscript>
</head>
<body>
  <!-- 6. 首屏 HTML 直接内联 -->
  <nav>...</nav>
  <header class="hero">...</header>

  <!-- 7. 异步加载 JS -->
  <script src="/js/app.js" defer></script>
  <!-- defer：DOM 解析完成后执行，按顺序 -->
  <!-- async：下载完成后立即执行，不保证顺序 -->

  <!-- 8. 延迟加载非关键 JS -->
  <script>
    // 交互后才需要加载的脚本
    document.addEventListener('DOMContentLoaded', () => {
      const script = document.createElement('script');
      script.src = '/js/analytics.js';
      script.async = true;
      document.body.appendChild(script);
    });
  </script>
</body>
</html>
```

## 2. 关键 CSS 提取

```javascript
// Critical（提取首屏 CSS）
const critical = require('critical');

critical.generate({
  base: 'dist/',
  src: 'index.html',
  target: {
    css: 'critical.css',
    html: 'index-critical.html',
  },
  width: 1300,
  height: 900,
});
```

## 3. 资源优先级检查清单

```
阻塞渲染的资源（尽快加载）：
├─ <head> 中的 <link rel="stylesheet">
├─ <head> 中的 <script>（无 async/defer）
└─ 字体文件

关键资源（预加载）：
├─ 首屏图片
├─ 首屏字体
└─ Web App Manifest

延迟加载的资源：
├─ 非首屏图片（loading="lazy"）
├─ 非关键 CSS
├─ 第三方脚本（async/defer）
├─ 分析/广告脚本
└─ 非首屏组件（动态导入）
```
