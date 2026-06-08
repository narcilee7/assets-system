# Mini-Framework：Virtual DOM 与 Diff 算法

## 1. VDOM 结构

```javascript
// VNode 表示
const vnode = {
  type: 'div',
  props: { id: 'app', class: 'container' },
  children: [
    { type: 'h1', props: {}, children: ['Hello'] },
    { type: 'p', props: {}, children: ['World'] },
  ],
};

// 对应 HTML
// <div id="app" class="container">
//   <h1>Hello</h1>
//   <p>World</p>
// </div>
```

## 2. h 函数（创建 VNode）

```javascript
function h(type, props = null, ...children) {
  return {
    type,
    props,
    children: children.flat().map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return { type: 'text', props: null, children: String(child) };
      }
      return child;
    }),
  };
}

// 使用
const vnode = h('div', { id: 'app' },
  h('h1', null, 'Hello'),
  h('p', null, 'World')
);
```

## 3. render 函数（VNode → DOM）

```javascript
function render(vnode, container) {
  const dom = createDom(vnode);
  container.appendChild(dom);
}

function createDom(vnode) {
  if (vnode.type === 'text') {
    return document.createTextNode(vnode.children);
  }

  const dom = document.createElement(vnode.type);

  // 设置属性
  if (vnode.props) {
    Object.entries(vnode.props).forEach(([key, value]) => {
      if (key.startsWith('on') && typeof value === 'function') {
        dom.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        dom.setAttribute(key, value);
      }
    });
  }

  // 递归创建子节点
  vnode.children.forEach((child) => {
    dom.appendChild(createDom(child));
  });

  return dom;
}
```

## 4. Diff 算法（简化版）

```javascript
function patch(oldVNode, newVNode, container) {
  // 1. 类型不同：直接替换
  if (oldVNode.type !== newVNode.type) {
    const newDom = createDom(newVNode);
    container.replaceChild(newDom, oldVNode.dom);
    return;
  }

  // 2. 文本节点
  if (oldVNode.type === 'text') {
    if (oldVNode.children !== newVNode.children) {
      oldVNode.dom.textContent = newVNode.children;
    }
    newVNode.dom = oldVNode.dom;
    return;
  }

  // 3. 相同类型：复用 DOM
  const dom = (newVNode.dom = oldVNode.dom);

  // 4. 更新属性
  patchProps(oldVNode.props, newVNode.props, dom);

  // 5. 更新子节点
  patchChildren(oldVNode.children, newVNode.children, dom);
}

function patchProps(oldProps, newProps, dom) {
  // 移除旧属性
  if (oldProps) {
    Object.keys(oldProps).forEach((key) => {
      if (!newProps || !(key in newProps)) {
        dom.removeAttribute(key);
      }
    });
  }

  // 添加/更新新属性
  if (newProps) {
    Object.entries(newProps).forEach(([key, value]) => {
      if (!oldProps || oldProps[key] !== value) {
        dom.setAttribute(key, value);
      }
    });
  }
}

function patchChildren(oldChildren, newChildren, dom) {
  const len = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < len; i++) {
    if (i >= oldChildren.length) {
      // 新增节点
      dom.appendChild(createDom(newChildren[i]));
    } else if (i >= newChildren.length) {
      // 删除节点
      dom.removeChild(oldChildren[i].dom);
    } else {
      // 递归 diff
      patch(oldChildren[i], newChildren[i], dom);
    }
  }
}
```

## 5. 手写训练：完整 Diff 示例

```javascript
// 初始渲染
const oldVNode = h('ul', null,
  h('li', { key: 'a' }, 'A'),
  h('li', { key: 'b' }, 'B'),
  h('li', { key: 'c' }, 'C')
);
render(oldVNode, document.getElementById('app'));

// 更新
const newVNode = h('ul', null,
  h('li', { key: 'a' }, 'A'),
  h('li', { key: 'd' }, 'D'),  // 新增 D，替换 B
  h('li', { key: 'c' }, 'C')
);
patch(oldVNode, newVNode, document.getElementById('app'));
```
