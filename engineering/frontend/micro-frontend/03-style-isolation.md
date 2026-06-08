# 样式隔离

## 1. 样式污染问题

```css
/* 子应用 A 的样式 */
.btn { background: blue; }

/* 子应用 B 的样式 */
.btn { background: red; }

/* 问题：后加载的 .btn 会覆盖先加载的 */
```

## 2. 解决方案

### CSS Module（推荐用于构建时）

```css
/* Button.module.css */
.btn { background: blue; }

/* 编译后：Button_btn__3x7a9 { background: blue; } */
```

```javascript
import styles from './Button.module.css';

function Button() {
  return <button className={styles.btn}>Click</button>;
}
```

### 命名约定（BEM）

```css
/* app-a 的所有样式以 app-a- 为前缀 */
.app-a-btn { background: blue; }
.app-a-card { padding: 16px; }

/* app-b */
.app-b-btn { background: red; }
.app-b-card { padding: 24px; }
```

### Shadow DOM（最强隔离）

```javascript
// Web Components 方式
class MyComponent extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .btn { background: blue; }  /* 只在此 Shadow DOM 内有效 */
      </style>
      <button class="btn">Click</button>
    `;
  }
}
```

### 动态样式表（qiankun 方案）

```javascript
// qiankun 自动为子应用样式添加前缀
/* 原始 */
.btn { color: red; }

/* 转换后 */
[data-qiankun="app-a"] .btn { color: red; }
```

## 3. qiankun 样式隔离配置

```javascript
import { start } from 'qiankun';

start({
  // 严格样式隔离（Shadow DOM）
  // 优点：完全隔离
  // 缺点：部分 UI 库不兼容（如弹窗挂载到 body）
  strictStyleIsolation: true,

  // 实验性样式隔离（作用域前缀）
  // 优点：兼容性好
  // 缺点：不是 100% 隔离（@font-face、@keyframes 可能泄漏）
  experimentalStyleIsolation: true,
});
```

## 4. 全局样式处理

```javascript
// 子应用卸载时清理添加的全局样式
const addedStyles = [];

export async function mount() {
  // 添加全局样式
  const style = document.createElement('style');
  style.textContent = '.global-modal { z-index: 9999; }';
  document.head.appendChild(style);
  addedStyles.push(style);
}

export async function unmount() {
  // 清理全局样式
  addedStyles.forEach((style) => style.remove());
  addedStyles.length = 0;
}
```
