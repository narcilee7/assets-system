# HTML 性能

## 1. 资源加载优化

```html
<head>
  <!-- 预加载关键资源 -->
  <link rel="preload" href="/css/critical.css" as="style">
  <link rel="preload" href="/js/app.js" as="script">
  <link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

  <!-- 预连接 -->
  <link rel="preconnect" href="https://cdn.example.com">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">

  <!-- 预渲染（谨慎使用） -->
  <link rel="prerender" href="/next-page">

  <!-- 预获取 -->
  <link rel="prefetch" href="/about">

  <!-- 模块预加载 -->
  <link rel="modulepreload" href="/js/shared-module.js">
</head>
```

```html
<!-- 异步/延迟脚本 -->
<script src="/js/analytics.js" async></script>      <!-- 独立脚本，不依赖 DOM -->
<script src="/js/app.js" defer></script>             <!-- 依赖 DOM，按顺序执行 -->
<script type="module" src="/js/module.js"></script> <!-- 自动 defer -->

<!-- 动态加载（条件加载） -->
<script>
  if ('IntersectionObserver' in window) {
    const script = document.createElement('script');
    script.src = '/js/lazy-loading.js';
    script.async = true;
    document.head.appendChild(script);
  }
</script>
```

## 2. 图片优化

```html
<!-- 响应式图片 -->
<picture>
  <source
    srcset="image-400.webp 400w,
            image-800.webp 800w,
            image-1200.webp 1200w"
    sizes="(max-width: 600px) 400px,
           (max-width: 1000px) 800px,
           1200px"
    type="image/webp">
  <img
    src="image-800.jpg"
    srcset="image-400.jpg 400w,
            image-800.jpg 800w,
            image-1200.jpg 1200w"
    sizes="(max-width: 600px) 400px,
           (max-width: 1000px) 800px,
           1200px"
    alt="描述"
    loading="lazy"
    decoding="async"
    width="800"
    height="600">
</picture>

<!-- 懒加载 -->
<img src="placeholder.jpg" data-src="real-image.jpg" loading="lazy" alt="">

<!-- LQIP（Low Quality Image Placeholder） -->
<img
  src="data:image/jpeg;base64,/9j/4AAQ..."
  data-src="full-image.jpg"
  alt=""
  style="filter: blur(5px); transition: filter 0.3s;"
  onload="this.style.filter='none'">
```

## 3. 关键路径优化

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- 关键 CSS 内联 -->
  <style>
    /* 仅首屏需要的 CSS */
    .header { /* ... */ }
    .hero { /* ... */ }
    .nav { /* ... */ }
    /* 骨架屏样式 */
    .skeleton {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  </style>

  <!-- 非关键 CSS 异步加载 -->
  <link rel="preload" href="/css/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/css/styles.css"></noscript>

  <!-- 关键脚本 -->
  <script src="/js/critical.js" defer></script>
</head>
<body>
  <!-- 骨架屏（SSR 时直接渲染） -->
  <div id="app">
    <header class="skeleton" style="height: 60px;"></header>
    <main>
      <div class="skeleton" style="height: 400px;"></div>
      <div class="skeleton" style="height: 200px; margin-top: 20px;"></div>
    </main>
  </div>

  <!-- 主应用 -->
  <script type="module" src="/js/app.js"></script>
</body>
</html>
```

## 4. iframe 优化

```html
<!-- 懒加载 iframe -->
<iframe
  src="https://maps.example.com"
  loading="lazy"
  title="地图"
  width="600"
  height="400">
</iframe>

<!-- 用 poster 替代视频 iframe -->
<div class="video-embed" data-video-id="abc123">
  <img src="video-poster.jpg" alt="视频缩略图" loading="lazy">
  <button class="play-button" aria-label="播放视频">
    <svg><!-- play icon --></svg>
  </button>
</div>

<script>
  document.querySelectorAll('.video-embed').forEach(el => {
    el.querySelector('.play-button').addEventListener('click', () => {
      const id = el.dataset.videoId;
      el.innerHTML = `<iframe src="https://player.example.com/${id}?autoplay=1" 
                             allow="autoplay; fullscreen" 
                             loading="eager"></iframe>`;
    });
  });
</script>
```
