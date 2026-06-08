# React Fiber 架构

## 1. 为什么需要 Fiber

React 15 及之前的 Stack Reconciler 是**递归同步**的：

```javascript
// 同步递归更新（React 15）
function reconcile(parentDom, instance, element) {
  if (instance == null) {
    // 创建新 DOM
    const newInstance = instantiate(element);
    parentDom.appendChild(newInstance.dom);
    return newInstance;
  } else if (element == null) {
    // 删除 DOM
    parentDom.removeChild(instance.dom);
    return null;
  } else if (instance.element.type !== element.type) {
    // 替换 DOM
    const newInstance = instantiate(element);
    parentDom.replaceChild(newInstance.dom, instance.dom);
    return newInstance;
  } else {
    // 更新 DOM（递归子树）
    updateDomProperties(instance.dom, instance.element.props, element.props);
    instance.childInstances = reconcileChildren(instance, element);
    instance.element = element;
    return instance;
  }
}
```

**问题**：一旦开始更新，必须一口气走完整个组件树。对于深层组件树，这会**阻塞主线程**，导致：
- 动画卡顿
- 输入响应延迟
- 页面假死

## 2. Fiber 的核心思想

Fiber = **可中断的协作式调度单元**

```
Stack Reconciler (React 15)          Fiber Reconciler (React 16+)
   │                                      │
   │ 更新开始                              │ 更新开始
   ▼                                      ▼
┌─────────────┐                      ┌─────────────┐
│ 递归遍历整棵树 │                      │ 工作单元 1    │
│ (不可中断)   │                      │ (5ms)        │
│             │                      │──────┬──────│
│             │                      │      │ 检查时间 │
│             │                      │      ▼       │
│             │                      │  是否超 16ms? │
│             │                      │      │       │
│             │                      │  是 → yield   │
│             │                      │  否 → 工作单元2│
│             │                      │              │
│             │                      │ ...循环直到完成│
└─────────────┘                      └─────────────┘
```

## 3. Fiber 数据结构

Fiber 是一个**链表节点**，每个 Fiber 对应一个工作单元：

```typescript
interface Fiber {
  // 标识
  tag: WorkTag;              // 类型标记：FunctionComponent / ClassComponent / HostComponent 等
  key: string | null;
  elementType: any;          // 创建时传入的 type
  type: any;                 // 解析后的 type
  stateNode: any;            // 对应的 DOM 节点或实例

  // 树结构（链表实现）
  return: Fiber | null;      // parent
  child: Fiber | null;       // first child
  sibling: Fiber | null;     // next sibling
  index: number;             // 在 siblings 中的索引

  // 副作用
  flags: Flags;              // Placement / Update / Deletion / Passive 等
  subtreeFlags: Flags;        // 子树的副作用聚合
  deletions: Fiber[] | null; // 待删除的子树

  // 双缓冲
  alternate: Fiber | null;   // 指向 current tree 或 workInProgress tree 的对应节点

  // 状态
  pendingProps: any;         // 新 props
  memoizedProps: any;        // 当前 props
  memoizedState: any;        // 当前 state / hooks 链表
  updateQueue: any;          // 更新队列

  // 调度
  lanes: Lanes;              // 本 Fiber 的更新优先级
  childLanes: Lanes;         // 子树的更新优先级
}
```

### 链表遍历算法

```javascript
// 简化版 Fiber 遍历（深度优先）
function performUnitOfWork(fiber) {
  // 1. 处理当前 Fiber（创建/更新 DOM，执行函数组件）
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }

  // 2. 返回下一个工作单元
  if (fiber.child) {
    return fiber.child;       // 先走子节点
  }

  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling; // 没有子节点，走兄弟节点
    }
    nextFiber = nextFiber.return; // 没有兄弟，回到父节点
  }

  return null; // 整棵树遍历完成
}
```

## 4. 双缓冲机制

React 维护两棵 Fiber 树：

```
Current Tree (当前屏幕)            WorkInProgress Tree (内存中构建)
   │                                    │
   │ 用户点击，setState                  │
   ▼                                    ▼
┌─────────────┐                    ┌─────────────┐
│   Fiber A   │◀── alternate ───▶│   Fiber A'  │
│   (display) │                    │  (building) │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ child                            │ child
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│   Fiber B   │◀── alternate ───▶│   Fiber B'  │
└─────────────┘                    └─────────────┘
```

- **current tree**：当前显示在屏幕上的树
- **workInProgress tree**：正在构建的新树
- `alternate`：两棵树对应节点的双向指针
- 构建完成后，`root.current = workInProgress`，两棵树交换角色

## 5. Render Phase（可中断）

```javascript
// 简化版工作循环
let nextUnitOfWork = null;
let workInProgressRoot = null;

function workLoop(deadline) {
  let shouldYield = false;

  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);

    // 每帧留出时间给浏览器（约 5ms 渲染一帧）
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (!nextUnitOfWork && workInProgressRoot) {
    // Render phase 完成，进入 Commit phase
    commitRoot(workInProgressRoot);
  }

  requestIdleCallback(workLoop);
}
```

**Render Phase 做了什么？**
1. 调用组件函数（或 Class 的 render）
2. 比较新旧 props/state，确定是否需要更新
3. 标记副作用 flags（Placement / Update / Deletion）
4. **不操作真实 DOM**（纯计算，可安全中断）

## 6. Commit Phase（不可中断）

```javascript
function commitRoot(root) {
  const finishedWork = root.finishedWork;

  // 1. BeforeMutation 阶段（读取 DOM 快照）
  commitBeforeMutationEffects(finishedWork);

  // 2. Mutation 阶段（操作 DOM）
  commitMutationEffects(finishedWork);

  // 3. Root 切换（双缓冲交换）
  root.current = finishedWork.alternate;

  // 4. Layout 阶段（同步执行 useLayoutEffect，读取 DOM 布局）
  commitLayoutEffects(finishedWork);

  // 5. Passive 阶段（异步调度 useEffect）
  flushPassiveEffects();
}
```

**为什么 Commit Phase 不可中断？**
- DOM 操作必须是原子性的（防止用户看到半成品 UI）
- useLayoutEffect 需要同步读取布局信息

## 7. 手写训练：最小 Fiber 实现

```javascript
// 创建 Fiber 节点
function createFiber(type, props, parent) {
  return {
    type,
    props,
    parent,
    child: null,
    sibling: null,
    dom: null,
    alternate: null,
    effectTag: null,
  };
}

// 渲染入口
function render(element, container) {
  wipRoot = {
    dom: container,
    props: { children: [element] },
    alternate: currentRoot,
  };
  nextUnitOfWork = wipRoot;
}

// 工作单元
function performUnitOfWork(fiber) {
  // 创建 DOM
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // 协调子元素
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);

  // 返回下一个工作单元
  if (fiber.child) return fiber.child;
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling;
    nextFiber = nextFiber.parent;
  }
  return null;
}

// 协调子元素（diff）
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate?.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    const sameType = oldFiber && element && element.type === oldFiber.type;

    if (sameType) {
      // UPDATE：类型相同，复用 DOM
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      };
    }
    if (element && !sameType) {
      // PLACEMENT：新元素或类型不同
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT',
      };
    }
    if (oldFiber && !sameType) {
      // DELETION：旧元素被移除
      oldFiber.effectTag = 'DELETION';
      deletions.push(oldFiber);
    }

    if (oldFiber) oldFiber = oldFiber.sibling;

    if (index === 0) {
      wipFiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

// 提交阶段
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) return;

  const domParent = fiber.parent.dom;

  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === 'DELETION') {
    domParent.removeChild(fiber.dom);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}
```
