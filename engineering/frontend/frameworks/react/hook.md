# Hook实现原理

## 一、Hooks 的设计前提：为什么不是类组件？

在讲实现之前，先推导**为什么 React 团队要造 Hooks**。

类组件的问题不是"语法丑"，而是**组合性（Composition）被破坏了**：

| 问题 | 表现 |
|------|------|
| **逻辑分散** | 订阅在 `componentDidMount`，清理在 `componentWillUnmount`，相关代码横跨文件 |
| **复用困难** | Render Props / HOC 嵌套地狱，类型推导断裂 |
| **编译不友好** | Class 的 `this` 绑定让 minifier 和 tree-shaking 难以优化 |
| **this 心智负担** | `this.setState`  vs  `setState`，`this.props` 的闭包陷阱 |

Hooks 的核心设计目标：**让函数组件拥有状态，同时保持函数的组合性**。

---

## 二、Hooks 存在哪里？不是组件函数里

这是最常见的误解。

```js
function Component() {
  const [count, setCount] = useState(0); // 这个状态存在哪？
}
```

**答案**：存在 **Fiber 节点**的 `memoizedState` 上。

```
Component 函数执行
      ↓
调用 useState() —— React 不看你传了什么名字
      ↓
从 currentlyRenderingFiber.memoizedState 取出第 N 个 Hook 节点
      ↓
返回 [hook.memoizedState, dispatch]
```

每个 Hook 对应一个节点：

```js
// 简化版 Hook 数据结构
{
  memoizedState: any,       // Hook 自己的值（state/effect/ref/等）
  baseState: any,           // 基础状态（用于跳过已处理更新）
  baseQueue: Update | null, // 基础更新队列（存储被跳过的低优先级更新）
  queue: UpdateQueue | null,// 当前更新队列
  next: Hook | null,        // 指向下一个 Hook → 构成链表
}
```

**为什么用链表而不是数组？**

链表在**中断恢复**时更灵活。如果渲染被中断，链表可以停在任意节点，下次从 `workInProgressHook` 指针继续。数组需要维护索引，且扩容/缩容成本高。

---

## 三、Dispatcher 机制：Mount 和 Update 两套实现

React 维护了一个全局变量 `ReactCurrentDispatcher.current`，它是一个对象，包含所有 Hook 的实现：

```js
// Mount 阶段用的 Dispatcher
const HooksDispatcherOnMount = {
  useState: mountState,
  useEffect: mountEffect,
  useRef: mountRef,
  useMemo: mountMemo,
  useCallback: mountCallback,
  // ...
};

// Update 阶段用的 Dispatcher
const HooksDispatcherOnUpdate = {
  useState: updateState,
  useEffect: updateEffect,
  useRef: updateRef,
  useMemo: updateMemo,
  useCallback: updateCallback,
  // ...
};
```

在 render 函数组件之前，React 根据 `current === null`（是否首次挂载）来切换 Dispatcher：

```js
function renderWithHooks(current, workInProgress, Component, props) {
  currentlyRenderingFiber = workInProgress;
  workInProgress.memoizedState = null;  // 重置 Hooks 链表头
  workInProgress.updateQueue = null;    // 重置 Effect 链表
  
  ReactCurrentDispatcher.current = 
    current === null 
      ? HooksDispatcherOnMount 
      : HooksDispatcherOnUpdate;
  
  let children = Component(props);
  
  // 重置全局变量，防止泄漏
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;
  currentlyRenderingFiber = null;
  currentHook = null;
  workInProgressHook = null;
  
  return children;
}
```

**为什么需要两套 Dispatcher？**

Mount 和 Update 的逻辑差异很大：
- Mount：创建 Hook 节点，初始化状态
- Update：复用 Hook 节点，处理更新队列，比较依赖

用两套实现避免在函数内部做大量 `if (isMount)` 分支判断，是经典的**策略模式**。

---

## 四、useState 的完整实现

### 4.1 Mount 阶段

```js
function mountState(initialState) {
  const hook = mountWorkInProgressHook();
  
  // 支持懒初始化
  if (typeof initialState === 'function') {
    initialState = initialState();
  }
  
  hook.memoizedState = hook.baseState = initialState;
  
  // 创建更新队列
  const queue = {
    pending: null,           // 环形链表，存储待处理的更新
    dispatch: null,          // setState 函数
    lastRenderedReducer: basicStateReducer,  // 用于 eager state 优化
    lastRenderedState: initialState,
  };
  
  hook.queue = queue;
  
  // dispatch 绑定到固定的 fiber 和 queue，保证引用稳定
  const dispatch = queue.dispatch = dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue
  );
  
  return [hook.memoizedState, dispatch];
}
```

`mountWorkInProgressHook` 创建 Hook 并挂载到链表：

```js
function mountWorkInProgressHook() {
  const hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };
  
  if (workInProgressHook === null) {
    // 第一个 Hook，挂在 Fiber.memoizedState 上
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // 追加到链表尾部
    workInProgressHook = workInProgressHook.next = hook;
  }
  
  return hook;
}
```

### 4.2 Update 阶段

```js
function updateState(initialState) {
  // useState 就是 useReducer 的特例，reducer 是 basicStateReducer
  return updateReducer(basicStateReducer, initialState);
}

function basicStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action;
}
```

`updateReducer` 是 Hooks 更新机制的核心：

```js
function updateReducer(reducer, initialArg) {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;
  
  queue.lastRenderedReducer = reducer;
  
  const current = currentHook;
  let baseQueue = current.baseQueue;
  
  // === 合并 pending 更新到 baseQueue ===
  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    if (baseQueue !== null) {
      // 把 pendingQueue 拼接到 baseQueue 后面
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;  // 清空 pending
  }
  
  // === 遍历更新队列 ===
  if (baseQueue !== null) {
    const first = baseQueue.next;
    let newState = current.baseState;
    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;
    let update = first;
    
    do {
      const updateLane = update.lane;
      
      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        // 优先级不够，跳过这个更新，但保留到 baseQueue 下次处理
        const clone = {
          lane: updateLane,
          action: update.action,
          next: null,
        };
        
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }
      } else {
        // 优先级足够，处理这个更新
        if (newBaseQueueLast !== null) {
          // 前面有跳过的更新，这个也要保留（保证顺序）
          const clone = {
            lane: NoLane,
            action: update.action,
            next: null,
          };
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }
        
        const action = update.action;
        newState = reducer(newState, action);
      }
      
      update = update.next;
    } while (update !== null && update !== first);
    
    if (newBaseQueueLast === null) {
      // 没有跳过的更新，baseState 就是最终状态
      newBaseState = newState;
    } else {
      // 形成环形链表
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    
    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;
    queue.lastRenderedState = newState;
  }
  
  const dispatch = queue.dispatch;
  return [hook.memoizedState, dispatch];
}
```

### 4.3 dispatchAction：setState 的底层

```js
function dispatchAction(fiber, queue, action) {
  const lane = requestUpdateLane(fiber);
  
  const update = {
    lane: lane,
    action: action,           // 新状态或更新函数
    eagerReducer: null,
    eagerState: null,
    next: null,
  };
  
  // === 把 update 加入 pending 队列（环形链表）===
  const pending = queue.pending;
  if (pending === null) {
    // 第一个更新，自己指向自己
    update.next = update;
  } else {
    // 插入到环形链表头部
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;
  
  // === 检查是否在 render 阶段触发更新 ===
  const alternate = fiber.alternate;
  if (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  ) {
    // Render phase update：标记，会在当前 render 中重新处理
    didScheduleRenderPhaseUpdate = true;
  } else {
    // === 优化路径：eager state ===
    if (
      fiber.lanes === NoLanes &&
      (alternate === null || alternate.lanes === NoLanes)
    ) {
      // 当前没有正在进行的渲染，直接计算结果
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        const currentState = queue.lastRenderedState;
        const eagerState = lastRenderedReducer(currentState, action);
        update.eagerReducer = lastRenderedReducer;
        update.eagerState = eagerState;
        
        if (Object.is(eagerState, currentState)) {
          // 状态没变，跳过调度！
          return;
        }
      }
    }
    
    // 正常路径：进入调度
    scheduleUpdateOnFiber(fiber, lane);
  }
}
```

**几个关键点**：

1. **环形链表**：`queue.pending` 指向最后一个 update，`pending.next` 指向第一个。这样可以在 O(1) 时间插入新 update。

2. **eager state 优化**：如果当前没有正在渲染的任务，且状态没变（`Object.is`），直接返回，不触发调度。这是 `setState(sameValue)` 不会导致重渲染的原因。

3. **Render phase update**：如果在 render 函数里调用了 `setState`，React 会标记 `didScheduleRenderPhaseUpdate`，这次 render 完成后会**重新从头开始 render**，直到没有 render phase update 为止（有上限，防止死循环）。

---

## 五、useEffect 的实现

### 5.1 Mount

```js
function mountEffect(create, deps) {
  return mountEffectImpl(
    PassiveEffect | PassiveStaticEffect,  // Fiber flags
    HookPassive,                          // Hook flags
    create,
    deps
  );
}

function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  
  // 标记当前 Fiber 有 Passive effect
  currentlyRenderingFiber.flags |= fiberFlags;
  
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,  // tag：标记需要执行
    create,                      // create 回调
    undefined,                   // destroy（清理函数），mount 时还没有
    nextDeps                     // 依赖数组
  );
}
```

`pushEffect` 创建 effect 节点，挂在 Fiber 的 `updateQueue` 上：

```js
function pushEffect(tag, create, destroy, deps) {
  const effect = {
    tag,
    create,
    destroy,
    deps,
    next: null,
  };
  
  let componentUpdateQueue = currentlyRenderingFiber.updateQueue;
  
  if (componentUpdateQueue === null) {
    componentUpdateQueue = {
      lastEffect: null,
      stores: null,
    };
    currentlyRenderingFiber.updateQueue = componentUpdateQueue;
    // 形成环形链表
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    const firstEffect = lastEffect.next;
    lastEffect.next = effect;
    effect.next = firstEffect;
    componentUpdateQueue.lastEffect = effect;
  }
  
  return effect;
}
```

**Effect 链表是环形的**，挂在 `Fiber.updateQueue.lastEffect` 上。

### 5.2 Update

```js
function updateEffect(create, deps) {
  return updateEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy = undefined;
  
  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState;
    destroy = prevEffect.destroy;
    
    if (nextDeps !== null) {
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // 依赖没变，push 一个不带 HookHasEffect 的 effect
        // 它会被收集，但不会执行
        hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps);
        return;
      }
    }
  }
  
  // 依赖变了，标记需要执行
  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    destroy,
    nextDeps
  );
}
```

`areHookInputsEqual` 就是简单的浅比较：

```js
function areHookInputsEqual(nextDeps, prevDeps) {
  if (prevDeps === null) return false;
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) continue;
    return false;
  }
  return true;
}
```

### 5.3 执行时机：Commit Phase 的 Passive 阶段

useEffect 在 **Mutation 之后、Layout 之前**异步调度执行：

```js
function commitPassiveMountEffects(finishedRoot, finishedWork) {
  commitPassiveMountEffects_begin(finishedWork);
}

function commitPassiveMountEffects_begin(finishedWork) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    
    if (fiber.flags & Passive) {
      try {
        const hook = fiber.memoizedState;
        if (hook !== null) {
          const effect = hook.memoizedState;
          // 只执行带 HookHasEffect 标记的 effect
          if (effect.tag & HookHasEffect) {
            const create = effect.create;
            const destroy = create();  // 执行 create，返回值是 destroy
            effect.destroy = destroy;
          }
        }
      } catch (error) {
        captureCommitPhaseError(fiber, error);
      }
    }
    
    // 遍历子树...
  }
}
```

**useEffect vs useLayoutEffect 的本质区别**：

| | useLayoutEffect | useEffect |
|---|---|---|
| **执行时机** | Commit Phase 的 Layout 阶段（同步） | Commit Phase 结束后（异步，宏任务） |
| **阻塞渲染** | 是 | 否 |
| **用途** | DOM 测量、同步重绘 | 数据获取、订阅、手动 DOM 操作 |
| **为什么** | 需要在浏览器绘制前完成 | 不阻塞视觉反馈 |

---

## 六、useRef 的实现：最简单也最特殊

```js
function mountRef(initialValue) {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;
}

function updateRef(initialValue) {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState;  // 直接返回同一个对象，不做任何比较
}
```

**为什么 ref 变化不会触发重渲染？**

因为 `updateRef` 不修改任何 Fiber flags，不加入更新队列，React 根本不知道 ref 变了。ref 是**逃逸舱口**，用于命令式地操作 DOM 或保存不需要触发渲染的值。

---

## 七、useMemo / useCallback：依赖比较的缓存

```js
function mountMemo(nextCreate, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function updateMemo(nextCreate, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  
  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];  // 直接返回缓存值
      }
    }
  }
  
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}
```

useCallback 就是 useMemo 的语法糖：

```js
function mountCallback(callback, deps) {
  const hook = mountWorkInProgressHook();
  hook.memoizedState = [callback, deps];
  return callback;
}

function updateCallback(callback, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  
  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];
      }
    }
  }
  
  hook.memoizedState = [callback, nextDeps];
  return callback;
}
```

**`useCallback(fn, deps)` 等价于 `useMemo(() => fn, deps)`**。

---

## 八、为什么 Hooks 必须在顶层调用？底层原因

```js
function Component() {
  const [a, setA] = useState(0);   // Hook 1
  
  if (condition) {
    const [b, setB] = useState(0); // ❌ 条件调用
  }
  
  const [c, setC] = useState(0);   // Hook 3
}
```

React 不通过名字匹配 Hook，而是通过**调用顺序**：

```
第 1 次 render:  Hook 1 → a,  Hook 2 → b,  Hook 3 → c
第 2 次 render:  Hook 1 → a,  (条件为false，跳过),  Hook 2 → 认为是 c 的 hook！
```

结果：Hook 2 拿到了 c 的 `memoizedState`，类型不匹配，React 会报错或崩溃。

底层实现：

```js
function updateWorkInProgressHook() {
  let nextCurrentHook;
  
  if (currentHook === null) {
    // 第一个 Hook，从 current Fiber 的 memoizedState 开始
    nextCurrentHook = current.memoizedState;
  } else {
    // 沿着链表往下走
    nextCurrentHook = currentHook.next;
  }
  
  currentHook = nextCurrentHook;
  
  // 克隆到 workInProgress
  const newHook = {
    memoizedState: currentHook.memoizedState,
    baseState: currentHook.baseState,
    baseQueue: currentHook.baseQueue,
    queue: currentHook.queue,
    next: null,
  };
  
  if (workInProgressHook === null) {
    currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
  } else {
    workInProgressHook = workInProgressHook.next = newHook;
  }
  
  return newHook;
}
```

React 只是机械地沿着 `next` 指针往下走，如果调用次数变了，就会**错位**。

---

## 九、闭包陷阱的底层原因

```js
function Component() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count); // 永远是 0！
    }, 1000);
    
    return () => clearInterval(timer);
  }, []); // 依赖数组为空
}
```

**为什么？**

1. 第一次 render：`count = 0`，useEffect 的 `create` 回调捕获了 `count = 0`
2. `setInterval` 的回调闭包引用了这个 `count = 0`
3. 后续 render 虽然 `count` 变了，但 useEffect 的依赖数组为空，`areHookInputsEqual` 返回 true，不会重新执行 effect
4. 所以 `setInterval` 里的 `count` 永远是第一次 render 时的 0

**解法**：

```js
// 1. 函数式更新（不依赖闭包里的 count）
setInterval(() => {
  setCount(c => c + 1);
}, 1000);

// 2. 加入依赖数组
useEffect(() => {
  const timer = setInterval(() => console.log(count), 1000);
  return () => clearInterval(timer);
}, [count]);

// 3. 用 ref 保持最新值
const countRef = useRef(count);
countRef.current = count;
useEffect(() => {
  const timer = setInterval(() => console.log(countRef.current), 1000);
  return () => clearInterval(timer);
}, []);
```

---

## 十、批量更新（Batching）与 Hooks

React 18 的自动批处理：

```js
function handleClick() {
  setA(1);  // 不立即执行
  setB(2);  // 不立即执行
  setC(3);  // 不立即执行
  // 函数结束后，三次 setState 合并成一次渲染
}
```

底层：`dispatchAction` 里不会立即调用 `scheduleUpdateOnFiber`，而是先把 update 加入 `queue.pending`。事件处理函数执行完毕后，React 的批处理机制统一调度一次渲染。

---

## 十一、面试架构师级问题

### Q1: "useState 的 dispatch 为什么引用稳定？"

`dispatchAction` 通过 `Function.prototype.bind` 绑定到固定的 `fiber` 和 `queue`：

```js
const dispatch = queue.dispatch = dispatchAction.bind(null, fiber, queue);
```

这意味着无论组件渲染多少次，`setCount` 的引用都是同一个函数对象。所以可以把 `setCount` 传给子组件的 `memo` 组件而不会导致失效。

### Q2: "useEffect 的清理函数为什么在上一次 effect 的 create 之后、下一次 create 之前执行？"

Commit Phase 遍历 effect 链表时：
1. 先执行所有 effect 的 `destroy`（上一次 effect 返回的清理函数）
2. 再执行所有 effect 的 `create`（新的 effect 回调）

这保证了组件卸载时清理，以及依赖变化时**先清理旧订阅，再建立新订阅**。

### Q3: "Hooks 链表和 Effect 链表有什么区别？"

| | Hooks 链表 | Effect 链表 |
|---|---|---|
| **挂载位置** | `Fiber.memoizedState` | `Fiber.updateQueue.lastEffect` |
| **结构** | 单向链表 | 环形链表 |
| **用途** | 保存 Hook 状态 | 收集副作用回调 |
| **生命周期** | 持久存在 | 每次 render 重建 |

### Q4: "为什么 useRef 不会触发重渲染，但 useState 会？"

`updateRef` 直接返回 `hook.memoizedState`（同一个对象引用），不修改 Fiber flags，不进入调度队列。`updateState` 会调用 `dispatchAction`，把 update 加入队列，触发 `scheduleUpdateOnFiber`。

### Q5: "React 18 的 useId 是怎么保证 SSR 和水合一致的？"

useId 利用**组件树的遍历顺序**生成唯一标识。服务端和客户端用相同的遍历算法（前序遍历 + 组件类型标记），生成相同的 id 序列。底层使用 "fizz" 架构，在流式渲染时也能保持 id 的确定性。

---
