# React Hooks 原理

## 1. Hooks 的设计动机

React 15 的状态复用方案：
- Mixin：命名冲突、来源不透明
- HOC：嵌套地狱（Wrapper Hell）、props 命名冲突
- Render Props：代码结构复杂

Hooks 的解决思路：**将状态逻辑从组件树中抽离到函数中调用**。

## 2. Hooks 链表结构

React 内部用**单向链表**存储 Hooks，按调用顺序排列：

```
Fiber.memoizedState (指向第一个 Hook)
   │
   ▼
┌─────────────────────────────────────────────┐
│ Hook 1: useState("initial")                 │
│   ├── memoizedState: "initial"              │
│   ├── baseState: "initial"                  │
│   ├── queue: { pending: null }              │
│   └── next ─────────────────────────────────┼──┐
│                                             │  │
│ Hook 2: useEffect(fn, [dep1])               │◀─┘
│   ├── memoizedState: { create: fn, deps: [...] }
│   ├── baseState: null                       │
│   ├── queue: null                           │
│   └── next ─────────────────────────────────┼──┐
│                                             │  │
│ Hook 3: useState(0)                         │◀─┘
│   ├── memoizedState: 0                      │
│   └── next: null                            │
└─────────────────────────────────────────────┘
```

**关键规则**：Hooks 必须在顶层按固定顺序调用，不能在 if/for 中使用。因为 React 靠**调用顺序**来匹配前后两次渲染的 Hook。

## 3. useState 简化实现

```javascript
// React 内部状态
let currentlyRenderingFiber = null;  // 当前正在渲染的 Fiber
let workInProgressHook = null;        // 当前正在工作的 Hook
let firstWorkInProgressHook = null;   // 第一个 Hook（链表头）

function useState(initialState) {
  // 获取或创建 Hook 节点
  const hook = mountWorkInProgressHook();

  // 从 alternate（current tree）获取上一次的 state
  const current = currentlyRenderingFiber.alternate;
  if (current) {
    const prevHook = current.memoizedState;
    hook.memoizedState = prevHook.memoizedState;
    hook.baseState = prevHook.baseState;
    hook.queue = prevHook.queue;
  } else {
    hook.memoizedState = initialState;
    hook.baseState = initialState;
    hook.queue = { pending: null, dispatch: null, last: null };
  }

  // 合并所有 pending updates
  const queue = hook.queue;
  let baseState = hook.baseState;

  if (queue.pending) {
    let first = queue.pending.next;
    let update = first;
    do {
      baseState = updateReducer(baseState, update.action);
      update = update.next;
    } while (update !== first);
    queue.pending = null;
  }

  hook.memoizedState = baseState;

  // dispatch 函数（闭包绑定当前 fiber 和 queue）
  const dispatch = dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue
  );

  return [baseState, dispatch];
}

function dispatchAction(fiber, queue, action) {
  const update = {
    action,
    next: null,
  };

  // 将 update 加入环形链表
  const last = queue.last;
  if (last === null) {
    update.next = update;  // 自环
    queue.last = update;
  } else {
    update.next = last.next;
    last.next = update;
    queue.last = update;
  }

  // 触发调度
  scheduleUpdateOnFiber(fiber);
}

function mountWorkInProgressHook() {
  const hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };

  if (workInProgressHook === null) {
    // 第一个 Hook
    firstWorkInProgressHook = workInProgressHook = hook;
    currentlyRenderingFiber.memoizedState = hook;
  } else {
    // 追加到链表尾部
    workInProgressHook = workInProgressHook.next = hook;
  }

  return workInProgressHook;
}
```

## 4. useEffect 调度机制

```javascript
function useEffect(create, deps) {
  const hook = mountWorkInProgressHook();

  const nextDeps = deps === undefined ? null : deps;
  const effect = {
    tag: HookPassive,       // Passive = useEffect (非同步)
    create,                 // 副作用函数
    destroy: undefined,     // cleanup 函数
    deps: nextDeps,         // 依赖数组
    next: null,             // effect 链表指针
  };

  hook.memoizedState = effect;

  // 将 effect 加入 fiber.updateQueue
  const fiber = currentlyRenderingFiber;
  const lastEffect = fiber.updateQueue?.lastEffect;
  if (lastEffect === null) {
    fiber.updateQueue = { lastEffect: effect };
    effect.next = effect;  // 自环链表
  } else {
    const firstEffect = lastEffect.next;
    lastEffect.next = effect;
    effect.next = firstEffect;
    fiber.updateQueue.lastEffect = effect;
  }
}

// Commit phase 中异步执行 effect
function flushPassiveEffects() {
  // 先执行所有上一次的 destroy（cleanup）
  commitPassiveEffectDurations(root, finishedWork);

  // 再执行所有 create
  const firstEffect = finishedWork.updateQueue?.lastEffect?.next;
  if (firstEffect) {
    let effect = firstEffect;
    do {
      if (effect.tag & HookPassive) {
        effect.destroy = effect.create();  // 执行 create，保存返回值作为 destroy
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}
```

**useEffect vs useLayoutEffect**：

| 阶段 | useLayoutEffect | useEffect |
|------|-----------------|-----------|
| 执行时机 | Commit Phase 同步执行 | Commit Phase 后异步调度（requestIdleCallback） |
| 是否阻塞渲染 | 是（可能卡顿） | 否（不阻塞 paint） |
| 能否读取布局 | 能（DOM 已更新，浏览器未 paint） | 不能（浏览器可能已经 paint） |
| 适用场景 | DOM 测量、同步重绘 | 数据获取、订阅、手动 DOM 操作 |

## 5. Batching（批量更新）

```javascript
// React 18 自动 batching
function handleClick() {
  setCount(c => c + 1);  // 不立即重新渲染
  setFlag(f => !f);      // 不立即重新渲染
  // 函数执行完毕后，合并为一次重新渲染
}

// React 18 之前（非事件处理器中不会自动 batch）
setTimeout(() => {
  setCount(c => c + 1);  // 立即渲染一次
  setFlag(f => !f);      // 再渲染一次
}, 1000);

// React 18 之后（所有场景自动 batch）
setTimeout(() => {
  setCount(c => c + 1);  // 不立即渲染
  setFlag(f => !f);      // 函数结束后合并渲染
}, 1000);
```

**batching 的实现原理**：

```javascript
let isBatchingUpdates = false;
let pendingUpdates = [];

function setState(component, newState) {
  if (isBatchingUpdates) {
    // 批量模式下，暂存更新
    pendingUpdates.push({ component, newState });
  } else {
    // 非批量模式，立即更新
    component._pendingState = newState;
    scheduleUpdate(component);
  }
}

function batchedUpdates(fn) {
  isBatchingUpdates = true;
  try {
    fn();
  } finally {
    isBatchingUpdates = false;
    // 批量处理所有暂存的更新
    flushPendingUpdates();
  }
}
```

## 6. 闭包陷阱（Stale Closure）

```javascript
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);  // ❌ 永远是 0！
      setCount(count + 1); // ❌ 永远是 1！
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 空依赖数组，闭包捕获了初始 count

  // ✅ 修复方案 1：使用函数式更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1);  // 总是读取最新 state
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ✅ 修复方案 2：把 count 加入依赖
  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [count]);
}
```

## 7. Hooks 规则与 ESLint

```javascript
// ❌ 错误：条件调用
function BadComponent() {
  if (condition) {
    const [state, setState] = useState(0);  // 运行时条件调用，Hook 顺序会乱
  }
}

// ✅ 正确：顶层调用
function GoodComponent() {
  const [state, setState] = useState(0);

  useEffect(() => {
    if (condition) {
      setState(1);  // 条件在 effect 内部
    }
  }, [condition]);
}
```

React 的 ESLint 规则 `react-hooks/rules-of-hooks` 通过**静态分析**检测 Hooks 调用是否在顶层。
