# Mini-Framework：Fiber 调度器

## 1. 为什么需要 Fiber

传统递归渲染的问题：
- 一旦开始渲染，无法中断
- 大型组件树导致主线程阻塞，页面卡顿

Fiber 架构：
- 将渲染工作拆分为小单元
- 每个单元可中断、可恢复
- 利用浏览器空闲时间（`requestIdleCallback`）

## 2. Fiber 节点结构

```javascript
const fiber = {
  type: 'div',        // 组件类型或 HTML 标签
  props: {},          // 属性
  dom: null,          // 对应的 DOM 节点

  // 树结构
  parent: null,       // 父 Fiber
  child: null,        // 第一个子 Fiber
  sibling: null,      // 下一个兄弟 Fiber

  // 链表（用于遍历）
  alternate: null,    // 上一次渲染的 Fiber（双缓存）

  // 副作用
  effectTag: null,    // 'PLACEMENT' | 'UPDATE' | 'DELETION'
};
```

## 3. 调度循环

```javascript
// 下一个待处理的 Fiber
let nextUnitOfWork = null;
// 当前正在构建的 Fiber 树
let wipRoot = null;
// 上一次渲染的 Fiber 树
let currentRoot = null;

// 调度循环
function workLoop(deadline) {
  let shouldYield = false;

  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;  // 时间片用完
  }

  // 所有工作完成，提交变更
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

// 执行一个工作单元
function performUnitOfWork(fiber) {
  // 1. 创建 DOM（如果是首次渲染）
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // 2. 创建子 Fiber
  const elements = fiber.props.children;
  let index = 0;
  let prevSibling = null;

  while (index < elements.length) {
    const element = elements[index];
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    };

    if (index === 0) {
      fiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }

  // 3. 返回下一个工作单元（深度优先遍历）
  if (fiber.child) return fiber.child;

  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling;
    nextFiber = nextFiber.parent;
  }

  return null;
}
```

## 4. 双缓存与 Diff

```javascript
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,  // 指向旧树，用于 diff
  };
  nextUnitOfWork = wipRoot;
}

function commitRoot() {
  commitWork(wipRoot.child);
  currentRoot = wipRoot;  // 新树变为旧树
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) return;

  const domParent = fiber.parent.dom;

  if (fiber.effectTag === 'PLACEMENT' && fiber.dom) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === 'DELETION') {
    domParent.removeChild(fiber.dom);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}
```

## 5. 手写训练：优先级调度

```javascript
// 模拟 React 的 Lane 模型（简化版）
const PriorityLevels = {
  NoPriority: 0,
  ImmediatePriority: 1,   // 用户输入、点击
  UserBlockingPriority: 2, // 动画
  NormalPriority: 3,       // 普通更新
  LowPriority: 4,          // 数据分析
  IdlePriority: 5,         // 预加载
};

let currentPriority = PriorityLevels.NormalPriority;

function scheduleUpdate(fiber, priority) {
  // 高优先级打断低优先级
  if (priority < currentPriority) {
    // 保存当前工作，稍后恢复
    wipRoot = {
      ...wipRoot,
      alternate: currentRoot,
    };
    currentPriority = priority;
  }

  nextUnitOfWork = wipRoot;
}

// 使用
scheduleUpdate(someFiber, PriorityLevels.ImmediatePriority);  // 紧急更新
```
