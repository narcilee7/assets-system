# 渲染管线

## 1. 完整渲染流程

```
URL 输入
  ↓
DNS 解析 → TCP 连接 → HTTP 请求 → 响应
  ↓
HTML 字节流
  ↓
[HTML Parser] → DOM Tree
  ↓（遇到 <link rel="stylesheet">）
[CSS Parser] → CSSOM Tree
  ↓
[Style Calculation] → 计算每个节点的 Computed Style
  ↓
[Layout] → 生成 Layout Tree（盒模型、位置、大小）
  ↓
[Layerize] → 生成 Layer Tree（哪些元素需要单独图层）
  ↓
[Paint] → 生成 Paint Records（绘制指令列表）
  ↓
[Tiling] → 将图层切分为 Tiles
  ↓
[Raster] → 栅格化（GPU/CPU）→ 位图
  ↓
[Composite] → 合成图层 → 最终画面
  ↓
Display
```

## 2. 关键阶段详解

### 2.1 HTML 解析

```javascript
// HTML 解析器遇到 <script> 时的行为

// 1. 同步脚本（默认）：阻塞解析，立即下载执行
<script src="app.js"></script>

// 2. async：异步下载，下载完成后立即执行（可能阻塞解析）
<script async src="analytics.js"></script>

// 3. defer：异步下载，DOM 解析完成后执行（按顺序）
<script defer src="app.js"></script>

// 4. module：自动 defer，支持 ES Modules
<script type="module" src="app.js"></script>
```

| 属性 | 下载时机 | 执行时机 | 是否阻塞解析 | 执行顺序 |
|------|---------|---------|-------------|---------|
| 无 | 同步 | 立即 | ✅ 阻塞 | 按出现顺序 |
| async | 并行 | 下载完立即 | ⚠️ 可能阻塞 | 下载完成顺序 |
| defer | 并行 | DOMReady 后 | ❌ 不阻塞 | 按出现顺序 |
| module | 并行 | DOMReady 后 | ❌ 不阻塞 | 按出现顺序 |

### 2.2 CSSOM 构建

```css
/* CSS 会阻塞渲染！ */
/* 因为 CSSOM 必须完整才能计算 Computed Style */

/* 解决方案 1：关键 CSS 内联 */
<style>
  /* 首屏关键样式 */
  .hero { ... }
  .nav { ... }
</style>

<!-- 非关键样式异步加载 -->
<link rel="preload" href="non-critical.css" as="style" onload="this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="non-critical.css"></noscript>

/* 解决方案 2：媒体查询 */
<link rel="stylesheet" href="print.css" media="print">
<link rel="stylesheet" href="mobile.css" media="(max-width: 768px)">
```

### 2.3 Layout（回流）

```javascript
// 触发 Layout（Reflow）的操作：
// 1. 读取几何属性
const width = element.offsetWidth;   // 触发 Layout
const height = element.clientHeight; // 触发 Layout
const rect = element.getBoundingClientRect(); // 触发 Layout

// 2. 写入几何属性
element.style.width = '100px';       // 触发 Layout
element.style.height = '200px';      // 触发 Layout
element.classList.add('expanded');   // 可能触发 Layout

// 3. 添加/删除 DOM 节点
container.appendChild(newNode);      // 触发 Layout
container.removeChild(oldNode);      // 触发 Layout

// 强制同步布局（Forced Synchronous Layout）= 性能杀手
// ❌ 错误：读写交错
for (let i = 0; i < elements.length; i++) {
  const height = elements[i].offsetHeight;  // 读 → 触发 Layout
  elements[i].style.height = height + 10 + 'px';  // 写 → 再次触发 Layout
}

// ✅ 优化：先读后写
const heights = elements.map((el) => el.offsetHeight);  // 批量读
heights.forEach((h, i) => {
  elements[i].style.height = h + 10 + 'px';  // 批量写
});

// ✅ 更优：使用 CSS transform（不触发 Layout）
element.style.transform = 'scaleY(1.1)';
```

### 2.4 Paint（重绘）

```javascript
// 触发 Paint 但不触发 Layout 的属性：
// color, background-color, border-color, visibility, box-shadow

// 不触发 Paint 的属性（仅 Composite）：
// transform, opacity, filter, clip-path

// 使用 will-change 提前创建图层
.animated-element {
  will-change: transform, opacity;
  /* 告诉浏览器：这个元素即将动画，请提前创建图层 */
}

/* 动画结束后移除 will-change */
.animated-element.finished {
  will-change: auto;
}
```

### 2.5 Composite（合成）

```
浏览器将页面分为多个图层（Layer）：
- 根图层（Viewport）
- 具有 opacity/transform/animation 的元素
- 具有 will-change 的元素
- 3D transform 元素
- video/canvas/iframe 元素
- position: fixed/sticky 元素
- 层叠上下文（z-index + 定位）

合成过程：
1. Compositor Thread 收集所有图层
2. 按 z-index 排序
3. 将可见的 Tile 送入 GPU
4. GPU 执行最终合成
```

```javascript
// 使用 Chrome DevTools Layers 面板查看图层

// 检查元素是否被提升为图层
function checkLayerPromotion(element) {
  const styles = window.getComputedStyle(element);
  const willChange = styles.willChange;
  const transform = styles.transform;
  const opacity = styles.opacity;

  console.log({
    willChange,
    transform,
    opacity,
    // 在 DevTools 中检查：
    // 元素 → 右侧 "Layers" 标签页
  });
}

// 使用 requestAnimationFrame 优化动画
function animate() {
  // 在 rAF 回调中，浏览器会在下一帧合成前执行
  // 这样可以避免强制同步布局
  requestAnimationFrame(() => {
    element.style.transform = `translateX(${currentX}px)`;
    currentX += speed;
    if (currentX < targetX) animate();
  });
}
```

## 3. 渲染性能优化清单

| 优化项 | 方法 | 效果 |
|--------|------|------|
| 减少 DOM 深度 | 扁平化结构 | 减少 Layout 计算 |
| 使用 transform | 替代 top/left/width/height | 跳过 Layout + Paint |
| 避免强制同步布局 | 批量读写 | 减少 Layout 次数 |
| 使用 CSS 包含 | `contain: layout paint` | 限制重排范围 |
| 图片尺寸声明 | `width`/`height` 属性 | 减少 CLS |
| 字体预加载 | `<link rel="preload">` | 减少 FOUT/FOIT |
| 内容可见性 | `content-visibility: auto` | 跳过视口外渲染 |
