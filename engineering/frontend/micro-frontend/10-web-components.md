# Web Components

## 1. 核心 API

```javascript
// 定义 Custom Element
class MicroApp extends HTMLElement {
  constructor() {
    super();
    // 创建 Shadow DOM（样式隔离）
    this.attachShadow({ mode: 'open' });
  }

  // 观察的属性变化
  static get observedAttributes() {
    return ['base-url', 'app-name'];
  }

  connectedCallback() {
    // 元素被插入 DOM
    this.render();
    this.loadApp();
  }

  disconnectedCallback() {
    // 元素被移除 DOM
    this.cleanup();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    // 属性变化
    if (oldVal !== newVal) {
      this.render();
    }
  }

  render() {
    const baseUrl = this.getAttribute('base-url');
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; height: 100%; }
        iframe { width: 100%; height: 100%; border: none; }
      </style>
      <iframe src="${baseUrl}"></iframe>
    `;
  }

  loadApp() {
    // 加载子应用逻辑
  }

  cleanup() {
    // 清理逻辑
  }
}

// 注册元素
customElements.define('micro-app', MicroApp);
```

```html
<!-- 使用 -->
<micro-app base-url="https://app-a.example.com" app-name="dashboard"></micro-app>
```

## 2. 与框架集成

```javascript
// React 中包装 Web Component
import React, { useEffect, useRef } from 'react';

function MicroAppWrapper({ baseUrl, appName }) {
  const ref = useRef();

  useEffect(() => {
    const el = ref.current;
    el.addEventListener('app-loaded', handleLoad);
    return () => el.removeEventListener('app-loaded', handleLoad);
  }, []);

  return <micro-app ref={ref} base-url={baseUrl} app-name={appName} />;
}

// Vue 中
// <template>
//   <micro-app :base-url="baseUrl" :app-name="appName" />
// </template>
```

## 3. Shadow DOM 样式隔离

```javascript
class StyledComponent extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        /* 只在此 Shadow DOM 内生效 */
        .btn {
          background: var(--primary-color, blue);
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
        }
      </style>
      <button class="btn">
        <slot>Default</slot>
      </button>
    `;
  }
}
```
