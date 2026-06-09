# 资源优先级

## 1. 预加载策略

```html
<!-- preconnect: 提前建立连接（DNS + TCP + TLS） -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- dns-prefetch: 仅 DNS 预解析 -->
<link rel="dns-prefetch" href="https://api.example.com">

<!-- prefetch: 预获取后续页面资源（低优先级） -->
<link rel="prefetch" href="/about">

<!-- preload: 预加载当前页面关键资源（高优先级） -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/hero.jpg" as="image" fetchpriority="high">

<!-- modulepreload: 预加载 JS 模块 -->
<link rel="modulepreload" href="/js/app.js">
```

## 2. fetchpriority

```html
<!-- 控制图片加载优先级 -->
<img src="hero.jpg" fetchpriority="high">     <!-- 首屏大图 -->
<img src="thumbnail.jpg" fetchpriority="low">  <!-- 下方缩略图 -->
```

```javascript
// 动态设置
const img = new Image();
img.fetchPriority = 'high';
img.src = '/critical-image.jpg';
```

## 3. 加载策略

| 策略 | 作用 | 适用 |
|------|------|------|
| preconnect | 建立连接 | 第三方域名（CDN、API、字体） |
| dns-prefetch | DNS 解析 | 可能访问的域名 |
| prefetch | 预获取 | 下一页资源 |
| preload | 预加载 | 当前页关键资源 |
| modulepreload | 预加载模块 | ESM 入口 |
