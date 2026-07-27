# React渲染机制

---

## 一、为什么需要 Fiber？Stack Reconciler 的问题

React 15 及之前是 **Stack Reconciler**，递归遍历 Virtual DOM 树。问题很直观：

```
递归调用栈一旦开始，必须一口气走完整棵树。
如果树很深、组件很多，主线程被阻塞，用户交互/动画卡顿。
```

**核心矛盾**：渲染是 CPU 密集型任务，但浏览器需要每 16.6ms（60fps）让出主线程给渲染流水线。

Fiber 的解决思路：**把递归改成链表遍历，把大任务拆成可中断的小单元**。

---

## 二、Fiber 是什么？数据结构层面

Fiber 不是"虚拟 DOM 的升级版"这种模糊说法。它是一棵**链表树**，每个节点是一个工作单元。

```js
// 简化版 Fiber 节点结构
function FiberNode(tag, pendingProps, key, mode) {
  // 实例标识
  this.tag = tag;           // 类型标记：FunctionComponent/ClassComponent/HostComponent等
  this.key = key;
  this.elementType = null;  // 创建时用的type（可能和resolved不同）
  this.type = null;         // 实际的组件类型
  
  // 链表指针 → 构成树结构
  this.return = null;       // 父节点
  this.child = null;        // 第一个子节点
  this.sibling = null;      // 下一个兄弟节点
  this.index = 0;           // 在父节点的children中的索引
  
  // 状态
  this.pendingProps = pendingProps;   // 新props
  this.memoizedProps = null;          // 上一次渲染的props
  this.memoizedState = null;          // 上一次渲染的state（Hooks链表头）
  this.updateQueue = null;            // 更新队列
  
  // 副作用
  this.flags = NoFlags;     // 副作用标记（Placement/Update/Deletion等）
  this.subtreeFlags = NoFlags;  // 子树的副作用汇总
  
  // 双缓冲
  this.alternate = null;    // 指向另一棵树的对应节点（current ↔ workInProgress）
  
  // 其他...
}
```

### 为什么是链表而不是递归？

递归的调用栈是隐式的、不可控的。链表是**显式的**：

- `child` → 往下走（递归的"进入"）
- `sibling` → 平行走（递归的"下一个兄弟"）
- `return` → 往回走（递归的"返回"）

这样 React 可以**在任意一个 Fiber 节点处理完后，检查是否还有时间片，没有就中断，把控制权交还浏览器**。

---

## 三、双缓冲：current 与 workInProgress

React 维护**两棵 Fiber 树**：

| 树 | 含义 | 可见性 |
|---|---|---|
| **current** | 当前屏幕上显示的树 | 用户可见 |
| **workInProgress** | 正在构建的新树 | 内存中，不可见 |

```
current Fiber A          workInProgress Fiber A'
       |                          |
    alternate  <────────────>  alternate
```

每次更新：
1. 基于 `current` 创建 `workInProgress`（通过 `alternate` 复用节点）
2. 在 `workInProgress` 树上执行渲染工作
3. 完成后，`workInProgress` 变成新的 `current`，`root.current` 指针切换

**为什么需要双缓冲？**
- 渲染过程可中断、可丢弃，不会污染当前显示
- 中断后可以恢复，因为 `workInProgress` 树的状态保存在内存中

---

## 四、渲染的两阶段：Render vs Commit

这是 React 最核心的设计决策之一。

### Phase 1: Render Phase（可中断）

```
beginWork: 自顶向下，创建/复用 Fiber 节点，计算新状态
    ↓
completeWork: 自底向上，收集副作用，构建 effect list
```

**beginWork** 的核心逻辑（简化）：

```js
function beginWork(current, workInProgress, renderLanes) {
  // 1. 检查是否可以复用 current 节点（props/key/type都没变）
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;
    if (oldProps === newProps && current.ref === workInProgress.ref) {
      // 可以复用，直接克隆
      // ...
    }
  }
  
  // 2. 根据 tag 分发到不同的处理函数
  switch (workInProgress.tag) {
    case FunctionComponent:
      return updateFunctionComponent(current, workInProgress, renderLanes);
    case ClassComponent:
      return updateClassComponent(current, workInProgress, renderLanes);
    case HostComponent:  // DOM节点
      return updateHostComponent(current, workInProgress, renderLanes);
    // ...
  }
}
```

**completeWork** 负责：
- 创建/更新真实 DOM 节点（但**不插入文档**）
- 向上收集 `flags`（副作用标记）
- 处理 `ref`、`context` 等

### Phase 2: Commit Phase（不可中断）

```
BeforeMutation: 读取 DOM 快照（getSnapshotBeforeUpdate）
    ↓
Mutation: 执行 DOM 操作（插入/更新/删除）
    ↓
Layout: 执行 useLayoutEffect、ref 回调、componentDidMount/Update
    ↓
Passive: 调度 useEffect（异步执行）
```

**为什么 Commit 不能中断？**
- DOM 操作必须原子性完成，否则用户看到中间态
- 生命周期和 effect 的执行顺序必须保证

---

## 五、调度系统：从 Time Slicing 到 Lane 模型

### 5.1 Scheduler 包

React 有一个独立的 `scheduler` 包，核心是一个**优先级队列**：

```js
// 简化版
function unstable_scheduleCallback(priorityLevel, callback) {
  const currentTime = getCurrentTime();
  const startTime = currentTime;
  
  // 根据优先级计算过期时间
  let timeout;
  switch (priorityLevel) {
    case ImmediatePriority: timeout = -1; break;
    case UserBlockingPriority: timeout = 250; break;
    case NormalPriority: timeout = 5000; break;
    case LowPriority: timeout = 10000; break;
    case IdlePriority: timeout = -1; break; // 永不过期
  }
  
  const expirationTime = startTime + timeout;
  
  // 放入最小堆（优先级队列）
  push(timerQueue, { callback, startTime, expirationTime });
  
  // 请求调度
  requestHostCallback(flushWork);
}
```

### 5.2 时间切片（Time Slicing）

```js
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    // shouldYield() 检查是否超过 5ms 时间片
    performUnitOfWork(workInProgress);
  }
}
```

`shouldYield()` 的实现：
- 使用 `MessageChannel`（比 setTimeout 更精确）
- 每帧预留时间给浏览器渲染
- 如果超过 5ms，中断，让出主线程

### 5.3 Lane 模型（React 18）

React 17 之前用 **Expiration Time**（过期时间戳）表示优先级，React 18 改为 **Lane 模型**。

**为什么换？**

Expiration Time 的问题是**优先级是线性的**（数字越小优先级越高），但 React 18 需要**批量处理多个优先级的更新**（比如 Transition + Urgent 同时存在）。

Lane 用**位运算**表示：

```js
// 源码中的 Lane 定义（简化）
export const NoLanes: Lanes = /*                       */ 0b0000000000000000000000000000000;
export const SyncLane: Lane = /*                       */ 0b0000000000000000000000000000001;
export const InputContinuousHydrationLane: Lane = /*   */ 0b0000000000000000000000000000010;
export const InputContinuousLane: Lane = /*            */ 0b0000000000000000000000000000100;
export const DefaultHydrationLane: Lane = /*           */ 0b0000000000000000000000000001000;
export const DefaultLane: Lane = /*                    */ 0b0000000000000000000000000010000;
export const TransitionHydrationLane: Lane = /*        */ 0b0000000000000000000000000100000;
export const TransitionLane1: Lane = /*                */ 0b0000000000000000000000001000000;
// ... 更多 Transition Lane
export const IdleLane: Lane = /*                       */ 0b0100000000000000000000000000000;
export const OffscreenLane: Lane = /*                  */ 0b1000000000000000000000000000000;
```

**关键设计**：
- 每个更新被分配一个或多个 Lane（位掩码）
- 多个 Lane 可以**共存**（按位或 `|=`）
- 可以**批量提取**同一优先级的更新（按位与 `&`）
- Transition 有多个 Lane（TransitionLane1-16），避免互相阻塞

**调度入口**：

```js
function ensureRootIsScheduled(root: FiberRoot, currentTime: number) {
  const existingCallbackNode = root.callbackNode;
  
  // 1. 标记所有过期的 Lane
  markStarvedLanesAsExpired(root, currentTime);
  
  // 2. 获取下一个要处理的 Lanes
  const nextLanes = getNextLanes(root, workInProgressRootRenderLanes);
  
  if (nextLanes === NoLanes) {
    // 没有工作要做
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }
  
  // 3. 根据 Lane 优先级决定调度策略
  const newCallbackPriority = getHighestPriorityLane(nextLanes);
  
  if (existingCallbackNode !== null) {
    const existingCallbackPriority = root.callbackPriority;
    if (existingCallbackPriority === newCallbackPriority) {
      // 优先级相同，复用现有回调
      return;
    }
    // 优先级不同，取消旧回调，调度新回调
    cancelCallback(existingCallbackNode);
  }
  
  // 4. 调度新的渲染任务
  let newCallbackNode;
  if (newCallbackPriority === SyncLane) {
    // 同步优先级：立即执行（微任务队列）
    newCallbackNode = scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
  } else {
    // 并发优先级：通过 Scheduler 调度
    newCallbackNode = scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root),
    );
  }
  
  root.callbackNode = newCallbackNode;
  root.callbackPriority = newCallbackPriority;
}
```

---

## 六、并发特性如何依赖 Fiber 架构

### 6.1 useTransition

```js
function App() {
  const [isPending, startTransition] = useTransition();
  const [count, setCount] = useState(0);
  
  function handleClick() {
    startTransition(() => {
      setCount(c => c + 1);  // 标记为 TransitionLane（低优先级）
    });
  }
  
  return (
    <>
      {isPending && <Spinner />}
      <button onClick={handleClick}>{count}</button>
    </>
  );
}
```

**底层发生了什么？**

1. `startTransition` 包裹的 `setCount` 被标记为 **TransitionLane**
2. 这个更新的优先级低于用户输入（InputContinuousLane）
3. 如果用户在 Transition 渲染过程中点击按钮，新的用户输入可以**插队**
4. 浏览器空闲时再继续 Transition 的渲染

### 6.2 Suspense 与选择性水合（Selective Hydration）

React 18 的 Suspense 不只是"加载中"的 UI：

```jsx
<Suspense fallback={<Spinner />}>
  <Comments />  {/* 异步组件 */}
</Suspense>
```

**服务端场景**：
1. 服务端渲染 `<Comments />` 的 fallback（Spinner）
2. 通过 **Streaming HTML** 逐步发送真实内容
3. 客户端收到后，**选择性水合**（Selective Hydration）— 不阻塞其他部分的交互

**关键机制**：
- `SuspenseComponent` 的 Fiber 节点会捕获子树的 throw
- 子树抛出 Promise 时，React 标记该子树为 "suspended"
- 等 Promise resolve 后，重新调度该子树的渲染

---

## 七、关键源码路径速查

| 概念 | 源码文件 |
|---|---|
| Fiber 节点定义 | `ReactFiber.js` |
| 工作循环 | `ReactFiberWorkLoop.js` |
| beginWork | `ReactFiberBeginWork.js` |
| completeWork | `ReactFiberCompleteWork.js` |
| Commit 阶段 | `ReactFiberCommitWork.js` |
| Hooks 实现 | `ReactFiberHooks.js` |
| Lane 模型 | `ReactFiberLane.js` |
| Scheduler | `Scheduler.js` |
| Suspense 处理 | `ReactFiberSuspenseComponent.js` |

---

## 八、面试中的架构师级问题

1. **"Fiber 的链表结构相比递归，在工程上带来了什么 trade-off？"**
   - 优点：可中断、可恢复、支持优先级
   - 缺点：内存占用增加（每个节点多几个指针）、遍历逻辑更复杂、调试难度上升

2. **"Lane 模型相比 Expiration Time，解决了什么具体问题？"**
   - Expiration Time 是线性优先级，无法表达"多个优先级同时存在"
   - Lane 用位掩码，支持批量提取、合并、拆分，是 React 18 并发特性的基础

3. **"为什么 Commit Phase 不能中断，而 Render Phase 可以？"**
   - Render Phase 只操作内存中的 Fiber 树，不触及 DOM
   - Commit Phase 执行 DOM 变更，必须原子完成，否则用户看到不一致状态

4. **"React 18 的自动批处理（Automatic Batching）是怎么实现的？"**
   - 在事件处理函数中，多个 `setState` 不会立即触发更新
   - 而是先收集到 `updateQueue`，事件结束后统一处理
   - 通过 `unstable_batchedUpdates` 的隐式调用实现

---
