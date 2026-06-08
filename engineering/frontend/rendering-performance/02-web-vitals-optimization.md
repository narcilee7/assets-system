# Web Vitals 深度优化

## 1. LCP（Largest Contentful Paint）优化

```
LCP 元素通常是：
├─ <img>
├─ <image> inside <svg>
├─ <video> poster
├─ element with background-image
└─ block-level text element

目标：2.5s 内
```

### 优化策略

```html
<!-- 1. 预加载 LCP 图片 -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high">

<!-- 2. 使用现代图片格式 -->
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Hero" width="1200" height="600">
</picture>

<!-- 3. 图片必须有尺寸（避免 CLS） -->
<img src="photo.jpg" width="800" height="600" alt="Photo">
```

```javascript
// 4. 减少 TTFB（服务器响应时间）
// - CDN 边缘缓存
// - 服务端渲染（SSR）
// - 流式传输

// 5. 移除阻塞渲染的资源
// - 内联关键 CSS
// - 异步加载非关键 JS
```

## 2. INP（Interaction to Next Paint）优化

```
INP 测量：用户交互 → 下一帧绘制的时间
目标：200ms 内
```

### 优化策略

```javascript
// ❌ 同步处理大量数据（阻塞主线程）
function handleClick() {
  const results = heavyComputation(data);  // 500ms
  setState(results);
}

// ✅ 拆分长任务
async function handleClick() {
  const results = await scheduler.yield(() => heavyComputation(data));
  setState(results);
}

// ✅ 使用 requestIdleCallback（非紧急任务）
requestIdleCallback(() => {
  analytics.track(event);  //  analytics 可以延迟
});

// ✅ 使用 Web Worker
const worker = new Worker('worker.js');
worker.postMessage(data);
worker.onmessage = (e) => setState(e.data);
```

```javascript
// 事件节流（高频事件）
import { throttle, debounce } from 'lodash-es';

// 滚动事件节流
window.addEventListener('scroll', throttle(handleScroll, 16));  // ~60fps

// 搜索输入防抖
input.addEventListener('input', debounce(handleSearch, 300));
```

## 3. CLS（Cumulative Layout Shift）优化

```
CLS = 所有意外布局偏移的分数之和
目标：0.1 以下
```

### 优化策略

```html
<!-- 1. 图片/视频必须有尺寸 -->
<img src="photo.jpg" width="800" height="600">
<video width="640" height="360" poster="preview.jpg"></video>

<!-- 2. 字体预留空间 -->
<style>
  @font-face {
    font-family: 'Custom';
    src: url('/font.woff2') format('woff2');
    font-display: swap;  /* 先显示后备字体 */
  }
  .text {
    font-family: 'Custom', Arial, sans-serif;
    /* 确保后备字体和自定义字体尺寸接近 */
    line-height: 1.5;
  }
</style>

<!-- 3. 广告/嵌入内容预留空间 -->
<div style="min-height: 250px; background: #f0f0f0;">
  <!-- 广告加载后不会导致布局偏移 -->
</div>

<!-- 4. 避免在已有内容上方插入内容 -->
<!-- ❌ -->
<div id="banner">新 banner（把内容往下推）</div>
<!-- ✅ -->
<div style="position: fixed; top: 0;">新 banner（覆盖而非推动）</div>
```

## 4. TTFB / FCP 优化

```html
<!-- 1. 预连接关键域名 -->
<link rel="preconnect" href="https://cdn.example.com">
<link rel="dns-prefetch" href="https://api.example.com">

<!-- 2. 尽早发现关键资源 -->
<link rel="preload" href="/css/critical.css" as="style">
<link rel="preload" href="/js/main.js" as="script">

<!-- 3. 内联关键 CSS（< 14KB 可在一个 TCP 往返内传输） -->
<style>
  /* 首屏必需的 CSS */
  body { margin: 0; font-family: sans-serif; }
  .hero { height: 100vh; background: ... }
</style>
```
