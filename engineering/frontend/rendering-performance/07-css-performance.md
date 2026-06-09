# CSS 性能

## 1. 选择器优化

```css
/* ❌ 最右边选择器优先匹配 */
/* 浏览器从右向左解析 */
div ul li a span { }  /* 先找所有 span，再往上匹配 */

/* ✅ 使用类选择器 */
.nav-link { }  /* 直接匹配类名 */

/* ❌ 避免通配符 */
* { margin: 0; }  /* 匹配所有元素 */

/* ✅ 明确指定 */
body, h1, h2, p { margin: 0; }

/* ❌ 避免深层嵌套 */
.header .nav .menu .item .link { }

/* ✅ 扁平化 */
.nav-link { }
```

## 2. CSS Contain

```css
/* 隔离元素的渲染，防止影响外部 */
.widget {
  contain: layout;      /* 布局不影响外部 */
  contain: paint;       /* 绘制不影响外部 */
  contain: size;        /* 尺寸不影响外部 */
  contain: style;       /* 计数器/引号不影响外部 */
  contain: strict;      /* 包含所有（layout + paint + size） */
  contain: content;     /* layout + paint + style */
}

/* 用途：
   - 第三方 widget
   - 频繁更新的区域
   - 大量独立组件
*/
```

## 3. will-change

```css
/* 提示浏览器哪些属性即将变化，提前优化 */
.animated {
  will-change: transform;  /* 创建合成层 */
}

/* ⚠️ 注意事项：
   1. 不要滥用（消耗 GPU 内存）
   2. 动画结束后移除
   3. 最多同时存在几个 will-change 元素
*/

/* 动态添加/移除 */
.element {
  transition: transform 0.3s;
}
.element:hover {
  will-change: transform;
}
.element:not(:hover) {
  will-change: auto;
}
```

## 4. CSS 动画 vs JS 动画

```css
/* ✅ CSS 动画（推荐） */
/* 只触发 Composite，GPU 加速 */
.element {
  transition: transform 0.3s ease;
}
.element:hover {
  transform: translateX(100px);
}

@keyframes slide {
  from { transform: translateX(0); }
  to { transform: translateX(100px); }
}
```

```javascript
// ❌ JS 动画（触发 Reflow/Repaint）
function animate() {
  element.style.left = x + 'px';  // 触发 Reflow
  x++;
  requestAnimationFrame(animate);
}

// ✅ JS 动画（使用 transform）
function animate() {
  element.style.transform = `translateX(${x}px)`;  // 只触发 Composite
  x++;
  requestAnimationFrame(animate);
}

// ✅ 使用 Web Animations API
element.animate([
  { transform: 'translateX(0)' },
  { transform: 'translateX(100px)' }
], {
  duration: 300,
  easing: 'ease-out'
});
```

## 5. 其他 CSS 优化

```css
/* 避免 @import（阻塞渲染） */
/* ❌ */
@import url('/other.css');

/* ✅ 使用 <link> */
<link rel="stylesheet" href="/other.css">

/* 减少重绘 */
/* ❌ 修改这些属性触发重绘 */
color, background-color, border-color, box-shadow

/* ✅ 使用 transform/opacity */
transform, opacity

/* 减少布局抖动 */
/* 使用 transform 代替 top/left */
.modal {
  /* ❌ */
  /* position: absolute; top: 0; left: 0; */

  /* ✅ */
  position: fixed;
  transform: translateX(-100%);
}
.modal.open {
  transform: translateX(0);
}
```
