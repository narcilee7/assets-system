# 手写 Web Components 简化系统

## 目标

实现一个简化版 Web Components 框架，支持：
1. 声明式组件定义
2. 属性绑定和响应式更新
3. 事件系统
4. 插槽（Slot）机制

## 实现

```javascript
// mini-wc.js

class MiniWC extends HTMLElement {
  static registry = new Map();

  constructor() {
    super();
    this._props = {};
    this._state = {};
    this._slots = new Map();

    if (this.shadow) {
      this._shadow = this.attachShadow({ mode: this.shadow.mode || 'open' });
    }
  }

  // ========== 生命周期 ==========

  connectedCallback() {
    this._parseAttributes();
    this._parseSlots();
    this.beforeMount?.();
    this.render();
    this.mounted?.();
  }

  disconnectedCallback() {
    this.beforeUnmount?.();
    this._cleanup();
    this.unmounted?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    this._props[name] = this._castValue(name, newValue);
    this._onPropChange?.(name, this._props[name]);
    this.render();
  }

  // ========== 属性系统 ==========

  static get observedAttributes() {
    return this.props ? Object.keys(this.props) : [];
  }

  _parseAttributes() {
    const props = this.constructor.props || {};
    for (const [name, config] of Object.entries(props)) {
      const value = this.getAttribute(name);
      this._props[name] = this._castValue(name, value, config.type);
    }
  }

  _castValue(name, value, type) {
    const config = this.constructor.props?.[name];
    const targetType = type || config?.type;

    switch (targetType) {
      case 'boolean':
        return value !== null && value !== 'false';
      case 'number':
        return value === null ? config?.default : Number(value);
      case 'json':
        try {
          return value ? JSON.parse(value) : config?.default;
        } catch {
          return config?.default;
        }
      default:
        return value ?? config?.default ?? '';
    }
  }

  get props() {
    return { ...this._props };
  }

  setProps(updates) {
    Object.assign(this._props, updates);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined) {
        this.removeAttribute(key);
      } else {
        this.setAttribute(key, String(value));
      }
    }
    this.render();
  }

  // ========== 状态系统 ==========

  setState(updates) {
    const prev = { ...this._state };
    Object.assign(this._state, updates);
    this._onStateChange?.(prev);
    this.render();
  }

  get state() {
    return { ...this._state };
  }

  // ========== 插槽系统 ==========

  _parseSlots() {
    if (!this.shadow) return;

    // 收集具名插槽内容
    const slots = this.querySelectorAll('[slot]');
    slots.forEach(el => {
      this._slots.set(el.getAttribute('slot'), el);
    });

    // 默认插槽内容
    const defaultSlot = Array.from(this.childNodes).filter(
      n => !n.hasAttribute?.('slot')
    );
    if (defaultSlot.length) {
      this._slots.set('default', defaultSlot);
    }
  }

  renderSlot(name = 'default') {
    const content = this._slots.get(name);
    if (!content) return '';

    if (Array.isArray(content)) {
      return content.map(n => n.outerHTML || n.textContent).join('');
    }
    return content.outerHTML;
  }

  // ========== 渲染系统 ==========

  render() {
    const template = this.template?.() || '';
    const html = this._processTemplate(template);

    if (this._shadow) {
      this._shadow.innerHTML = `
        <style>${this.styles?.() || ''}</style>
        ${html}
      `;
    } else {
      this.innerHTML = html;
    }

    this._bindEvents();
  }

  _processTemplate(template) {
    return template
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
        return this._props[key] ?? this._state[key] ?? '';
      })
      .replace(/<slot\s+name="(\w+)"\s*\/?>/g, (match, name) => {
        return this.renderSlot(name);
      })
      .replace(/<slot\s*\/?>/g, () => this.renderSlot('default'));
  }

  _bindEvents() {
    const root = this._shadow || this;
    root.querySelectorAll('[data-on]').forEach(el => {
      const [event, handler] = el.getAttribute('data-on').split(':');
      el.addEventListener(event, (e) => {
        if (this[handler]) this[handler](e);
      });
    });
  }

  _cleanup() {
    // 清理事件监听器
  }

  // ========== 静态注册 ==========

  static define(tag) {
    if (!customElements.get(tag)) {
      customElements.define(tag, this);
    }
    MiniWC.registry.set(tag, this);
    return this;
  }
}

// ========== 使用示例 ==========

class Counter extends MiniWC {
  static props = {
    initial: { type: 'number', default: 0 },
    step: { type: 'number', default: 1 },
    label: { type: 'string', default: 'Count' },
  };

  shadow = { mode: 'open' };

  constructor() {
    super();
    this._state.count = 0;
  }

  connectedCallback() {
    this._state.count = this._props.initial;
    super.connectedCallback();
  }

  styles() {
    return `
      :host { display: inline-flex; align-items: center; gap: 0.5rem; }
      button {
        width: 32px; height: 32px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        background: white;
        cursor: pointer;
      }
      button:hover { background: #f3f4f6; }
      span { min-width: 40px; text-align: center; font-weight: 600; }
    `;
  }

  template() {
    return `
      <button data-on="click:decrement">-</button>
      <span>{{label}}: {{count}}</span>
      <button data-on="click:increment">+</button>
    `;
  }

  increment() {
    this.setState({ count: this._state.count + this._props.step });
  }

  decrement() {
    this.setState({ count: this._state.count - this._props.step });
  }
}

Counter.define('my-counter');
```

```html
<!-- 使用 -->
<my-counter initial="10" step="5" label="Score"></my-counter>

<my-counter label="Visitors">
  <span slot="extra">额外内容</span>
</my-counter>
```

```javascript
// 程序化控制
const counter = document.querySelector('my-counter');
counter.setProps({ step: 10 });
console.log(counter.props);  // { initial: 10, step: 10, label: 'Score' }
```

module.exports = { MiniWC };
```
