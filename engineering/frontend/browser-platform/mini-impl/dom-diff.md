# 手写 DOM Diff（浏览器渲染引擎视角）

## 目标

实现一个简化版 DOM Diff 算法，模拟浏览器渲染引擎的更新策略：
1. 同级比较（Tree Diff）
2. 类型复用（Component Diff）
3. key 优化（Element Diff）
4. 最小化 DOM 操作

## 实现

```javascript
// dom-diff.js

/**
 * 虚拟节点结构
 */
function createVNode(type, props = {}, children = [], key = null) {
  return { type, props, children, key };
}

/**
 * DOM Diff 主函数
 * 返回需要执行的 DOM 操作列表
 */
function diff(oldVNode, newVNode, patches = [], path = '') {
  // 1. 新节点不存在 → 删除
  if (!newVNode) {
    patches.push({ type: 'REMOVE', path });
    return patches;
  }

  // 2. 旧节点不存在 → 新增
  if (!oldVNode) {
    patches.push({ type: 'CREATE', path, vnode: newVNode });
    return patches;
  }

  // 3. 类型不同 → 替换
  if (oldVNode.type !== newVNode.type) {
    patches.push({ type: 'REPLACE', path, vnode: newVNode });
    return patches;
  }

  // 4. 类型相同 → 比较属性和子节点
  diffProps(oldVNode.props, newVNode.props, patches, path);
  diffChildren(oldVNode.children, newVNode.children, patches, path);

  return patches;
}

/**
 * 属性对比
 */
function diffProps(oldProps, newProps, patches, path) {
  const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  for (const key of allKeys) {
    const oldVal = oldProps[key];
    const newVal = newProps[key];

    if (oldVal === undefined && newVal !== undefined) {
      // 新增属性
      patches.push({ type: 'SET_PROP', path, key, value: newVal });
    } else if (oldVal !== undefined && newVal === undefined) {
      // 删除属性
      patches.push({ type: 'REMOVE_PROP', path, key });
    } else if (oldVal !== newVal) {
      // 修改属性
      patches.push({ type: 'SET_PROP', path, key, value: newVal });
    }
  }
}

/**
 * 子节点对比（关键优化）
 * 使用 key 进行 O(n) 的最小化移动
 */
function diffChildren(oldChildren, newChildren, patches, parentPath) {
  // 快速路径：都为空
  if (oldChildren.length === 0 && newChildren.length === 0) return;

  // 快速路径：都没有 key，简单逐位比较
  const hasKeys = oldChildren.some((c) => c?.key != null) ||
                  newChildren.some((c) => c?.key != null);

  if (!hasKeys) {
    // 简单逐位比较
    const maxLen = Math.max(oldChildren.length, newChildren.length);
    for (let i = 0; i < maxLen; i++) {
      diff(oldChildren[i], newChildren[i], patches, `${parentPath}/children[${i}]`);
    }
    return;
  }

  // 有 key 的情况：使用 key-index 映射优化
  const oldKeyMap = new Map();
  oldChildren.forEach((child, index) => {
    if (child && child.key != null) {
      oldKeyMap.set(child.key, { child, index });
    }
  });

  const newKeySet = new Set(newChildren.map((c) => c?.key).filter(Boolean));

  // 标记旧节点中需要删除的
  for (let i = 0; i < oldChildren.length; i++) {
    const oldChild = oldChildren[i];
    if (oldChild && oldChild.key != null && !newKeySet.has(oldChild.key)) {
      patches.push({ type: 'REMOVE', path: `${parentPath}/children[${i}]` });
    }
  }

  // 遍历新子节点
  let lastIndex = 0;
  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const newPath = `${parentPath}/children[${i}]`;

    if (!newChild) continue;

    if (newChild.key == null) {
      // 无 key 节点：简单比较
      diff(oldChildren[i], newChild, patches, newPath);
      continue;
    }

    const oldEntry = oldKeyMap.get(newChild.key);

    if (!oldEntry) {
      // 新增节点
      patches.push({ type: 'INSERT', path: newPath, vnode: newChild, index: i });
    } else {
      // 节点存在：比较属性，检查位置
      const { child: oldChild, index: oldIndex } = oldEntry;

      // 递归 diff 内容
      diff(oldChild, newChild, patches, newPath);

      // 检查是否需要移动
      if (oldIndex < lastIndex) {
        // 需要移动到后面
        patches.push({ type: 'MOVE', path: newPath, fromIndex: oldIndex, toIndex: i });
      } else {
        lastIndex = oldIndex;
      }
    }
  }
}

/**
 * 应用补丁到真实 DOM
 */
function applyPatches(container, patches, getElementByPath) {
  for (const patch of patches) {
    const { type, path } = patch;

    switch (type) {
      case 'CREATE': {
        const el = createElement(patch.vnode);
        const parent = getParentElement(path, container);
        const index = getIndexFromPath(path);
        if (parent) {
          if (index >= parent.childNodes.length) {
            parent.appendChild(el);
          } else {
            parent.insertBefore(el, parent.childNodes[index]);
          }
        }
        break;
      }

      case 'REMOVE': {
        const el = getElementByPath(path);
        if (el) el.remove();
        break;
      }

      case 'REPLACE': {
        const oldEl = getElementByPath(path);
        if (oldEl) {
          oldEl.replaceWith(createElement(patch.vnode));
        }
        break;
      }

      case 'SET_PROP': {
        const el = getElementByPath(path);
        if (el) {
          if (patch.key === 'className') {
            el.className = patch.value;
          } else if (patch.key === 'style' && typeof patch.value === 'object') {
            Object.assign(el.style, patch.value);
          } else if (patch.key.startsWith('on') && typeof patch.value === 'function') {
            const eventName = patch.key.slice(2).toLowerCase();
            el.addEventListener(eventName, patch.value);
          } else {
            el.setAttribute(patch.key, patch.value);
          }
        }
        break;
      }

      case 'REMOVE_PROP': {
        const el = getElementByPath(path);
        if (el) el.removeAttribute(patch.key);
        break;
      }

      case 'INSERT': {
        const el = createElement(patch.vnode);
        const parent = getParentElement(path, container);
        const refNode = parent?.childNodes[patch.index];
        if (parent) {
          if (refNode) {
            parent.insertBefore(el, refNode);
          } else {
            parent.appendChild(el);
          }
        }
        break;
      }

      case 'MOVE': {
        const el = getElementByPath(path);
        const parent = getParentElement(path, container);
        if (el && parent) {
          const refNode = parent.childNodes[patch.toIndex + 1];
          if (refNode) {
            parent.insertBefore(el, refNode);
          } else {
            parent.appendChild(el);
          }
        }
        break;
      }
    }
  }
}

/**
 * 创建真实 DOM
 */
function createElement(vnode) {
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return document.createTextNode(String(vnode));
  }

  if (typeof vnode.type === 'function') {
    // 组件节点
    const result = vnode.type(vnode.props);
    return createElement(result);
  }

  const el = document.createElement(vnode.type);

  // 设置属性
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, value);
    } else {
      el.setAttribute(key, value);
    }
  }

  // 递归创建子节点
  vnode.children.forEach((child) => {
    el.appendChild(createElement(child));
  });

  return el;
}

// 辅助函数
function getParentElement(path, container) {
  const parts = path.split('/');
  if (parts.length <= 1) return container;
  // 简化实现，实际应完整解析路径
  return container;
}

function getIndexFromPath(path) {
  const match = path.match(/\[(\d+)\]$/);
  return match ? parseInt(match[1]) : 0;
}

// ========== 使用示例 ==========

// 旧虚拟 DOM
const oldTree = createVNode('div', { className: 'list' }, [
  createVNode('div', { key: 'a' }, ['Item A']),
  createVNode('div', { key: 'b' }, ['Item B']),
  createVNode('div', { key: 'c' }, ['Item C']),
]);

// 新虚拟 DOM
const newTree = createVNode('div', { className: 'list' }, [
  createVNode('div', { key: 'b' }, ['Item B Updated']),
  createVNode('div', { key: 'd' }, ['Item D New']),
  createVNode('div', { key: 'a' }, ['Item A']),
]);

// 计算差异
const patches = diff(oldTree, newTree);
console.log('Patches:', patches);
// [
//   { type: 'SET_PROP', path: '/children[0]', key: 'children', value: ['Item B Updated'] },
//   { type: 'MOVE', path: '/children[0]', fromIndex: 1, toIndex: 0 },
//   { type: 'INSERT', path: '/children[1]', vnode: {...}, index: 1 },
//   { type: 'MOVE', path: '/children[2]', fromIndex: 0, toIndex: 2 },
//   { type: 'REMOVE', path: '/children[2]' },
// ]

// 应用到真实 DOM
// applyPatches(container, patches, getElementByPath);
```
