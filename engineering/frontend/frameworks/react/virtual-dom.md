# Virtual DOM

## 虚拟 DOM 的本质：不是"JS 对象"这么简单

很多人把虚拟 DOM 说成"用 JS 对象描述真实 DOM"，这句话对，但太薄。React 里**至少存在两层"虚拟"结构**，它们分工不同：

| 层级 | 名称 | 存在时机 | 职责 |
|------|------|----------|------|
| **第一层** | `ReactElement` | 每次 render 调用时创建 | 描述"这次我想渲染什么" |
| **第二层** | `Fiber` | 组件挂载后持久存在 | 描述"当前正在处理的工作单元" |

---

## 一、ReactElement：JSX 的编译产物

你写的 JSX：

```jsx
function App() {
  return <div className="app"><span>hello</span></div>;
}
```

Babel 编译后变成：

```js
function App() {
  return React.createElement(
    'div',
    { className: 'app' },
    React.createElement('span', null, 'hello')
  );
}
```

`React.createElement` 返回的就是 **ReactElement**：

```js
// 简化版
const element = {
  $$typeof: Symbol.for('react.element'),  // 防止 XSS（JSON 无法携带 Symbol）
  type: 'div',                             // 标签名或组件函数
  key: null,
  ref: null,
  props: {
    className: 'app',
    children: {
      $$typeof: Symbol.for('react.element'),
      type: 'span',
      props: { children: 'hello' }
    }
  }
};
```

### 几个关键细节

**1. `$$typeof` 的防御性设计**

React 早期允许 `element = { type: 'div', props: {} }` 这种纯对象。后来发现如果服务端把用户输入的 JSON 直接塞进 props，攻击者可以构造 `{ type: 'script', props: { src: 'evil.js' } }` 来注入。

`Symbol.for('react.element')` 无法在 JSON 中序列化，所以**从服务端返回的恶意 JSON 永远成不了合法的 ReactElement**。

**2. `type` 的多样性**

```js
// type 可以是：
'type': 'div'                    // 字符串 → 原生 DOM 节点
'type': MyComponent               // 函数 → 函数组件
'type': class MyComponent {}     // 类 → 类组件
'type': React.Fragment           // Symbol → 片段
'type': React.lazy(...)          // 特殊标记 → 懒加载
```

**3. `props.children` 的规范化**

```js
// 你写的
<div>{a}{b}</div>

// 实际变成
React.createElement('div', null, a, b)

// props.children 是数组
{ children: [elementA, elementB] }

// 但如果是单个子元素
<div>{a}</div>
// props.children 不是数组，直接是 elementA
```

这也是为什么 React 内部有 `React.Children` API 来统一处理 children 的遍历。

---

## 二、Reconciliation：ReactElement → Fiber

每次组件 render，都会产生一棵新的 ReactElement 树。React 不会直接销毁旧 DOM 重建，而是要做 **Reconciliation（协调）**：

> 比较**新的 ReactElement 树**和**旧的 Fiber 树**，尽可能复用已有节点，最小化 DOM 操作。

### Diff 算法的三条假设（O(n) 的底气）

React 的 Diff 不是通用的树 Diff（那会是 O(n³)），而是基于两条业务假设：

1. **不同类型的元素 → 直接销毁重建**
   ```jsx
   // 从 <div> 变成 <span>，子树全部卸载
   <div><Counter /></div>  →  <span><Counter /></span>
   ```

2. **同层级比较，不跨层级移动**
   ```
   不会把 A 从第一层移到第二层去比较，那样复杂度爆炸。
   ```

3. **key 提供子元素的标识**
   ```jsx
   // 没有 key：React 按索引比较
   <li>A</li><li>B</li>  →  <li>B</li><li>A</li>
   // 结果：先改 A 的内容为 B，再改 B 的内容为 A（两次更新）
   
   // 有 key：React 知道只是位置交换
   <li key="a">A</li><li key="b">B</li>  →  <li key="b">B</li><li key="a">A</li>
   // 结果：移动 DOM 节点（一次移动操作）
   ```

### Diff 的核心逻辑（beginWork 里）

在 `beginWork` 中，React 根据 `workInProgress.tag` 分发处理。以 `HostComponent`（原生 DOM）为例：

```js
function reconcileChildren(current, workInProgress, nextChildren, renderLanes) {
  if (current === null) {
    // 首次挂载：直接创建新的 Fiber 子节点
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren, renderLanes);
  } else {
    // 更新：Diff 新旧子节点
    workInProgress.child = reconcileChildFibers(workInProgress, current.child, nextChildren, renderLanes);
  }
}
```

`reconcileChildFibers` 是 Diff 的入口，内部根据新子节点的类型走不同分支：

```js
function reconcileChildFibers(returnFiber, currentFirstChild, newChild, lanes) {
  // 1. 新子节点是单个 ReactElement
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        return placeSingleChild(reconcileSingleElement(returnFiber, currentFirstChild, newChild, lanes));
      // ...
    }
  }
  
  // 2. 新子节点是文本/数字
  if (typeof newChild === 'string' || typeof newChild === 'number') {
    return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFirstChild, '' + newChild, lanes));
  }
  
  // 3. 新子节点是数组（多个子元素）
  if (isArray(newChild)) {
    return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, lanes);
  }
  
  // 4. 其他情况（null、undefined 等）→ 删除旧子节点
  return deleteRemainingChildren(returnFiber, currentFirstChild);
}
```

### 数组子节点的 Diff 算法（reconcileChildrenArray）

这是 Diff 中最复杂的部分，也是面试常考点：

```js
function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
  let resultingFirstChild = null;
  let previousNewFiber = null;
  
  let oldFiber = currentFirstChild;
  let lastPlacedIndex = 0;
  let newIdx = 0;
  let nextOldFiber = null;
  
  // === Phase 1: 从左往右，按索引逐个比较 ===
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    if (oldFiber.index > newIdx) {
      nextOldFiber = oldFiber;
      oldFiber = null;
    } else {
      nextOldFiber = oldFiber.sibling;
    }
    
    const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], lanes);
    
    if (newFiber === null) {
      // key 或 type 不匹配，跳出第一阶段
      if (oldFiber === null) oldFiber = nextOldFiber;
      break;
    }
    
    if (shouldTrackSideEffects) {
      if (oldFiber && newFiber.alternate === null) {
        // 旧节点存在但新节点没有 alternate → 旧节点被删除了
        deleteChild(returnFiber, oldFiber);
      }
    }
    
    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    
    if (previousNewFiber === null) {
      resultingFirstChild = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }
    
    previousNewFiber = newFiber;
    oldFiber = nextOldFiber;
  }
  
  // === Phase 2: 新数组遍历完了，删除剩余旧节点 ===
  if (newIdx === newChildren.length) {
    deleteRemainingChildren(returnFiber, oldFiber);
    return resultingFirstChild;
  }
  
  // === Phase 3: 旧链表遍历完了，创建剩余新节点 ===
  if (oldFiber === null) {
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
      // ... 链接到结果链表
    }
    return resultingFirstChild;
  }
  
  // === Phase 4: 处理乱序（key 匹配但位置变了）===
  // 把剩余旧节点放入 Map<key, Fiber>，然后遍历剩余新节点查找复用
  const existingChildren = mapRemainingChildren(returnFiber, oldFiber);
  
  for (; newIdx < newChildren.length; newIdx++) {
    const newFiber = updateFromMap(existingChildren, returnFiber, newIdx, newChildren[newIdx], lanes);
    
    if (newFiber !== null) {
      if (shouldTrackSideEffects) {
        if (newFiber.alternate !== null) {
          // 复用了旧节点，从 Map 中删除
          existingChildren.delete(newFiber.key === null ? newIdx : newFiber.key);
        }
      }
      
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      // ... 链接
    }
  }
  
  // 删除 Map 中没被复用的旧节点
  if (shouldTrackSideEffects) {
    existingChildren.forEach(child => deleteChild(returnFiber, child));
  }
  
  return resultingFirstChild;
}
```

### 这个算法的核心思想

1. **先按索引从左往右匹配**：如果 key 和 type 都对得上，直接复用
2. **如果中间断了**：说明出现了插入/删除/重排
3. **把剩余旧节点放进 Map**：用 key 做索引，O(1) 查找
4. **遍历剩余新节点**：在 Map 里找可复用的旧节点
5. **最后删除没被复用的旧节点**

**时间复杂度**：O(n)，因为每个节点最多被访问两次（一次在链表，一次在 Map）。

---

## 三、虚拟 DOM 的"Diff"到底在比较什么？

很多人以为 Diff 是"比较两棵 ReactElement 树"，其实不是。

```
ReactElement 树          Fiber 树（current）        Fiber 树（workInProgress）
     ↓                         ↓                           ↓
  轻量、临时               持久、带状态                 正在构建的新树
  每次 render 新建          保存 hooks/state             基于 current 创建
```

**真正比较的是**：新的 ReactElement 和 **旧的 Fiber 节点**（通过 `alternate`）。

```js
function reconcileSingleElement(returnFiber, currentFirstChild, element, lanes) {
  const key = element.key !== null ? element.key : null;
  
  // 遍历旧子节点链表，找 key 和 type 都匹配的
  for (let child = currentFirstChild; child !== null; child = child.sibling) {
    if (child.key === key) {
      // key 匹配，检查 type
      if (child.elementType === element.type) {
        // key 和 type 都匹配 → 复用这个 Fiber 节点
        // 创建 workInProgress 版本（通过 alternate 关联）
        const existing = useFiber(child, element.props);
        existing.ref = coerceRef(returnFiber, child, element);
        existing.return = returnFiber;
        return existing;
      } else {
        // key 匹配但 type 不同 → 整棵子树销毁
        deleteRemainingChildren(returnFiber, child);
        break;
      }
    }
  }
  
  // 没有匹配的 → 创建新的 Fiber
  const created = createFiberFromElement(element, returnFiber.mode, lanes);
  created.ref = coerceRef(returnFiber, null, element);
  created.return = returnFiber;
  return created;
}
```

---

## 四、虚拟 DOM 与真实 DOM 的映射

### 创建真实 DOM（completeWork）

```js
function completeWork(current, workInProgress, renderLanes) {
  const newProps = workInProgress.pendingProps;
  
  switch (workInProgress.tag) {
    case HostComponent: {  // 原生 DOM 节点
      const type = workInProgress.type;
      
      if (current !== null && workInProgress.stateNode != null) {
        // 更新：复用已有 DOM 节点，只更新属性
        updateHostComponent(current, workInProgress, type, newProps);
      } else {
        // 首次创建
        const instance = createInstance(type, newProps, rootContainerInstance);
        workInProgress.stateNode = instance;
        
        // 把子节点的 DOM  append 进来
        appendAllChildren(instance, workInProgress, false, false);
      }
      return null;
    }
    // ...
  }
}
```

### DOM 操作在 Commit Phase 执行

Render Phase 只创建/更新 Fiber 树和 DOM 实例（`stateNode`），但**不插入文档**。

真正的 DOM 插入/更新/删除在 **Commit Phase** 的 Mutation 阶段：

```js
function commitMutationEffectsOnFiber(finishedWork, root, lanes) {
  const flags = finishedWork.flags;
  
  if (flags & Placement) {
    // 插入新节点
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
  
  if (flags & Update) {
    // 更新属性
    const instance = finishedWork.stateNode;
    commitUpdate(instance, finishedWork.updateQueue, ...);
    finishedWork.flags &= ~Update;
  }
  
  if (flags & Deletion) {
    // 删除节点
    const parentFiber = getHostParentFiber(finishedWork);
    commitDeletion(root, finishedWork, parentFiber);
    finishedWork.flags &= ~Deletion;
  }
  
  // 递归处理子树
  recursivelyTraverseMutationEffects(root, finishedWork, lanes);
}
```

---

## 五、常见误区与面试陷阱

### ❌ 误区 1："虚拟 DOM 一定比直接操作 DOM 快"

**真相**：虚拟 DOM 解决的是**开发体验**（声明式 UI），不是性能。

直接操作 DOM 在简单场景下更快。虚拟 DOM 的优势在于：
- 批量更新（减少重排重绘）
- 跨平台（React Native、React Three Fiber）
- 复杂 UI 下的可维护性

### ❌ 误区 2："key 用 index 没问题"

```jsx
// 危险：列表中间插入元素时，index 会导致所有后续元素被误判为更新
{items.map((item, index) => <li key={index}>{item.name}</li>)}
```

如果 `items` 从 `[A, B, C]` 变成 `[A, X, B, C]`：
- index 作为 key：B 的 key 从 1 变成 2，C 从 2 变成 3 → React 认为 B 和 C 都变了
- 稳定 id 作为 key：B 的 key 还是 "b"，C 还是 "c" → React 知道只是插入了 X

### ❌ 误区 3："ReactElement 就是 Fiber"

ReactElement 是**描述**，Fiber 是**工作单元**。
- ReactElement 每次 render 都新建，用完即丢
- Fiber 持久存在，保存状态、引用真实 DOM、构成链表树

---

## 六、一句话总结

> **虚拟 DOM 是 React 的"中间表示层"：JSX 编译成 ReactElement（描述层），Reconciliation 把 ReactElement 映射到 Fiber（工作层），Commit 阶段把 Fiber 的变更同步到真实 DOM（输出层）。**

---

## 你想继续往哪钻？

1. **"key 的 Diff 细节，那个 Map 是怎么构建的？"** → 深入 `reconcileChildrenArray` 的 Phase 4
2. **"ReactElement 的 $$typeof 防御，具体怎么防 XSS 的？"** → 安全层面
3. **"Fragment、Portal、Context 这些特殊类型在 Diff 里怎么处理的？"** → 特殊节点类型
4. **"React 18 的自动批处理，和虚拟 DOM 的更新队列有什么关系？"** → 批处理与更新机制

点一个？
