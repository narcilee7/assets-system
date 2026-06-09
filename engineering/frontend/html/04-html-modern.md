# 现代 HTML

## 1. Web Components

```javascript
// 定义 Custom Element
class TaskCard extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'status', 'priority'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  connectedCallback() {
    this.addEventListener('click', this.handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.handleClick);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  handleClick() {
    this.dispatchEvent(new CustomEvent('task-select', {
      detail: { id: this.getAttribute('task-id') },
      bubbles: true,
      composed: true,
    }));
  }

  getStyles() {
    return `
      :host {
        display: block;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        cursor: pointer;
        transition: box-shadow 0.2s;
      }
      :host(:hover) {
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      :host([priority="high"]) {
        border-left: 4px solid #ef4444;
      }
      :host([priority="medium"]) {
        border-left: 4px solid #f59e0b;
      }
      :host([priority="low"]) {
        border-left: 4px solid #10b981;
      }
      .title {
        font-weight: 600;
        margin: 0 0 0.5rem;
      }
      .status {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.875rem;
        background: #f3f4f6;
      }
      ::slotted([slot="footer"]) {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
      }
    `;
  }

  render() {
    const title = this.getAttribute('title') || 'Untitled';
    const status = this.getAttribute('status') || 'todo';
    const priority = this.getAttribute('priority') || 'medium';

    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      <h3 class="title">${title}</h3>
      <span class="status">${status}</span>
      <slot name="footer"></slot>
    `;
  }
}

customElements.define('task-card', TaskCard);
```

```html
<!-- 使用 -->
<task-card
  task-id="123"
  title="完成文档"
  status="in-progress"
  priority="high">
  <div slot="footer">
    <time>2024-06-15</time>
  </div>
</task-card>

<script>
  document.addEventListener('task-select', (e) => {
    console.log('Selected task:', e.detail.id);
  });
</script>
```

## 2. Template 和 Slot

```html
<!-- HTML Template -->
<template id="user-card-template">
  <style>
    .card {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #e5e7eb;
    }
    .info { flex: 1; }
    .name {
      font-weight: 600;
      margin: 0;
    }
    .email {
      color: #6b7280;
      font-size: 0.875rem;
      margin: 0.25rem 0 0;
    }
  </style>
  <div class="card">
    <div class="avatar">
      <slot name="avatar">
        <img src="default-avatar.png" alt="">
      </slot>
    </div>
    <div class="info">
      <h3 class="name"><slot name="name">Unknown</slot></h3>
      <p class="email"><slot name="email">No email</slot></p>
    </div>
  </div>
</template>

<!-- 克隆使用 -->
<script>
  const template = document.getElementById('user-card-template');

  function createUserCard(data) {
    const clone = template.content.cloneNode(true);
    clone.querySelector('slot[name="name"]').textContent = data.name;
    clone.querySelector('slot[name="email"]').textContent = data.email;
    if (data.avatar) {
      clone.querySelector('slot[name="avatar"] img').src = data.avatar;
    }
    return clone;
  }

  document.body.appendChild(createUserCard({
    name: 'Alice',
    email: 'alice@example.com',
    avatar: 'alice.png'
  }));
</script>
```

## 3. Declarative Shadow DOM

```html
<!-- 服务端渲染 Shadow DOM（Chrome 90+） -->
<task-card>
  <template shadowroot="open">
    <style>
      :host { display: block; padding: 1rem; }
      .title { font-weight: 600; }
    </style>
    <h3 class="title">完成文档</h3>
    <slot></slot>
  </template>
  <p>额外内容通过 slot 插入</p>
</task-card>
```

```javascript
// 服务端生成 Declarative Shadow DOM
function renderWebComponent(tag, styles, html, slots = {}) {
  const slotContent = Object.entries(slots)
    .map(([name, content]) => `<div slot="${name}">${content}</div>`)
    .join('');

  return `
    <${tag}>
      <template shadowroot="open">
        <style>${styles}</style>
        ${html}
      </template>
      ${slotContent}
    </${tag}>
  `;
}
```

## 4. Dialog 和 Popover

```html
<!-- 原生 Dialog -->
<button onclick="document.getElementById('modal').showModal()">
  打开对话框
</button>

<dialog id="modal">
  <form method="dialog">
    <h2>确认删除？</h2>
    <p>此操作不可撤销。</p>
    <div class="dialog-actions">
      <button value="cancel">取消</button>
      <button value="confirm" class="danger">删除</button>
    </div>
  </form>
</dialog>

<script>
  const modal = document.getElementById('modal');
  modal.addEventListener('close', () => {
    if (modal.returnValue === 'confirm') {
      performDelete();
    }
  });
</script>

<!-- Popover API（Chrome 114+） -->
<button popovertarget="menu" popovertargetaction="toggle">
  打开菜单
</button>

<div id="menu" popover>
  <ul>
    <li><a href="/profile">个人资料</a></li>
    <li><a href="/settings">设置</a></li>
    <li><button popovertarget="menu" popovertargetaction="hide">关闭</button></li>
  </ul>
</div>
```

## 5. Inert 和 Hidden=until-found

```html
<!-- inert：禁用交互和焦点，对辅助技术隐藏 -->
<div inert>
  <p>这部分内容当前不可用</p>
  <button>不可点击</button>
  <a href="/">不可访问</a>
</div>

<!-- hidden=until-found：可搜索但不可见 -->
<div hidden="until-found" id="section-details">
  <h2>详细信息</h2>
  <p>大量内容...</p>
</div>

<!-- 浏览器 find-in-page 可以找到并自动显示 until-found 内容 -->
```
