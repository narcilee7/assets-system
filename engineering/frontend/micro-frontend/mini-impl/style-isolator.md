# 手写样式隔离

## 1. 作用域前缀方案

```javascript
// style-isolator.js

class StyleIsolator {
  constructor(appName) {
    this.appName = appName;
    this.prefix = `[data-app="${appName}"]`;
    this.styleElements = [];
  }

  // 转换 CSS 规则，添加作用域前缀
  scopeCSS(css) {
    return css.replace(
      /([^{}]+)\{([^}]*)\}/g,
      (match, selector, declarations) => {
        // 跳过 @规则（@media、@keyframes 等）
        if (selector.trim().startsWith('@')) {
          // 递归处理 @media 内部
          if (selector.trim().startsWith('@media')) {
            const inner = this.scopeCSS(declarations);
            return `${selector}{${inner}}`;
          }
          return match;
        }

        // 为每个选择器添加前缀
        const scopedSelectors = selector
          .split(',')
          .map((s) => {
            const trimmed = s.trim();
            // 跳过 html、body、:root、@font-face 等全局选择器
            if (
              trimmed.startsWith('html') ||
              trimmed.startsWith('body') ||
              trimmed.startsWith(':root') ||
              trimmed.startsWith('*') ||
              trimmed.startsWith('@')
            ) {
              return trimmed;
            }
            // 添加前缀
            return `${this.prefix} ${trimmed}`;
          })
          .join(', ');

        return `${scopedSelectors} {${declarations}}`;
      }
    );
  }

  // 加载并隔离样式
  async loadStyle(url) {
    const response = await fetch(url);
    const css = await response.text();
    const scopedCSS = this.scopeCSS(css);

    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-app', this.appName);
    styleEl.textContent = scopedCSS;
    document.head.appendChild(styleEl);

    this.styleElements.push(styleEl);
    return styleEl;
  }

  // 添加内联样式
  injectStyle(css) {
    const scopedCSS = this.scopeCSS(css);
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-app', this.appName);
    styleEl.textContent = scopedCSS;
    document.head.appendChild(styleEl);
    this.styleElements.push(styleEl);
    return styleEl;
  }

  // 清理样式
  cleanup() {
    this.styleElements.forEach((el) => el.remove());
    this.styleElements = [];
  }
}

// ============ 测试 ============

const isolator = new StyleIsolator('app-a');

const css = `
  .btn { color: blue; padding: 8px; }
  .card { background: white; }
  @media (max-width: 768px) {
    .btn { width: 100%; }
  }
`;

const scoped = isolator.scopeCSS(css);
console.log(scoped);
// [data-app="app-a"] .btn { color: blue; padding: 8px; }
// [data-app="app-a"] .card { background: white; }
// @media (max-width: 768px) {
//   [data-app="app-a"] .btn { width: 100%; }
// }
```

## 2. Shadow DOM 封装

```javascript
// shadow-dom-wrapper.js

class ShadowAppWrapper extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  // 加载子应用到 Shadow DOM
  async loadApp(entryUrl) {
    // 获取子应用 HTML
    const html = await fetch(entryUrl).then((r) => r.text());
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 创建容器
    const container = document.createElement('div');
    container.id = 'app-root';

    // 复制样式到 Shadow DOM
    doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const styleLink = document.createElement('link');
      styleLink.rel = 'stylesheet';
      styleLink.href = new URL(link.href, entryUrl).href;
      this.shadow.appendChild(styleLink);
    });

    // 复制内联样式
    doc.querySelectorAll('style').forEach((style) => {
      const styleEl = document.createElement('style');
      styleEl.textContent = style.textContent;
      this.shadow.appendChild(styleEl);
    });

    // 添加容器
    this.shadow.appendChild(container);

    // 加载并执行脚本
    const scripts = doc.querySelectorAll('script');
    for (const script of scripts) {
      const scriptEl = document.createElement('script');
      if (script.src) {
        scriptEl.src = new URL(script.src, entryUrl).href;
      } else {
        scriptEl.textContent = script.textContent;
      }
      this.shadow.appendChild(scriptEl);
    }

    return container;
  }
}

customElements.define('shadow-app', ShadowAppWrapper);

// ============ 使用 ============

// <shadow-app id="app-a"></shadow-app>

const wrapper = document.getElementById('app-a');
wrapper.loadApp('http://localhost:3001');
```
