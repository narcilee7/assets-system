# CSS 性能

## 1. 渲染路径

```
关键渲染路径（Critical Rendering Path）

1. 构建 DOM
2. 构建 CSSOM（CSS Object Model）
   ├── 遇到 <link rel="stylesheet"> 阻塞渲染
   └── 内联 <style> 不阻塞（但影响 CSSOM 构建）
3. 合并为 Render Tree（只包含可见元素）
4. Layout（Reflow）：计算几何属性
5. Paint（Repaint）：绘制像素
6. Composite：合成层，GPU 渲染
```

```html
<!-- 关键 CSS 内联 -->
<head>
  <style>
    /* 首屏需要的 CSS */
    .header { /* ... */ }
    .hero { /* ... */ }
    .nav { /* ... */ }
  </style>

  <!-- 非关键 CSS 异步加载 -->
  <link rel="preload" href="/non-critical.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/non-critical.css"></noscript>
</head>
```

## 2. 避免重排与重绘

```css
/* 触发重排（Layout）的属性 */
width, height, padding, margin, border, display, position, top, left, right, bottom,
font-size, line-height, overflow, min/max-width, min/max-height

/* 触发重绘（Paint）的属性 */
color, background-color, border-color, visibility, box-shadow, border-radius

/* 仅触发合成（Composite）的属性 */
opacity, transform, filter, clip-path
```

```css
/* 优化动画 */
/* 差：触发重排 */
.card {
  left: 0;
  transition: left 0.3s;
}
.card:hover { left: 100px; }

/* 好：仅触发合成 */
.card {
  transform: translateX(0);
  transition: transform 0.3s;
}
.card:hover { transform: translateX(100px); }
```

## 3. contain 属性

```css
/* 隔离渲染区域，防止影响外部 */
.widget {
  contain: layout;       /* 布局隔离：内部变化不触发外部重排 */
}

.chat-message {
  contain: paint;        /* 绘制隔离：内部不溢出边界 */
}

.list-item {
  contain: size;         /* 尺寸隔离：大小不依赖子元素 */
}

.card {
  contain: layout paint size;  /* 严格模式 */
}

.modal {
  contain: strict;       /* layout + style + paint + size */
}

/* content-visibility：延迟渲染视口外内容 */
.feed-item {
  content-visibility: auto;
  contain-intrinsic-size: 200px;  /* 预估高度，避免布局抖动 */
}
```

## 4. will-change

```css
/* 提前通知浏览器某属性将变化，创建合成层 */
.animated-element {
  will-change: transform, opacity;
}

/* 动画结束后移除 */
.animated-element.animation-done {
  will-change: auto;
}

/* 谨慎使用 */
/* ❌ 不要这样做 */
* { will-change: transform; }  /* 创建过多合成层，耗尽 GPU 内存 */

/* ✅ 正确做法 */
.slider {
  will-change: transform;
}
.slider:not(.is-sliding) {
  will-change: auto;
}
```

## 5. 选择器性能

```css
/* 选择器从右向左解析 */

/* 差：先匹配所有 a，再向上找 .nav */
.nav a { }

/* 好：直接匹配 .nav-link */
.nav-link { }

/* 避免过深嵌套 */
/* 差 */
.header .nav .list .item .link span { }

/* 好 */
.nav-link-text { }

/* :has() 性能注意 */
/* 差：每次 DOM 变化都要重新计算 */
.card:has(.badge) { }

/* 好：有限范围 */
.container:has(> .highlight) { }
```

## 6. 关键 CSS 提取

```javascript
// Critical CSS 提取工具配置
// critical.config.js
const critical = require('critical');

critical.generate({
  base: 'dist/',
  src: 'index.html',
  target: {
    css: 'critical.css',
    html: 'index-critical.html',
    uncritical: 'uncritical.css',
  },
  width: 1300,
  height: 900,
});
```

```html
<!-- 最终输出 -->
<!DOCTYPE html>
<html>
<head>
  <style>
    /* ~10KB 关键 CSS */
    body { margin: 0; font-family: sans-serif; }
    .header { /* ... */ }
    .hero { /* ... */ }
  </style>
  <link rel="preload" href="/uncritical.css" as="style" 
        onload="this.onload=null;this.rel='stylesheet'">
</head>
