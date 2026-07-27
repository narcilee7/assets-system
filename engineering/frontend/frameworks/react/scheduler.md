# Scheduler

React 的调度系统是它从"同步渲染库"进化为"并发渲染引擎"的核心分水岭。我们从**为什么需要调度**开始，逐层拆到源码。

---

## 一、为什么需要调度？浏览器的帧模型

浏览器每帧约 **16.6ms**（60fps），在这 16.6ms 内要完成：

```
输入事件处理 → JS执行 → 样式计算 → 布局 → 绘制 → 合成
     ↑___________________________________________|
                    用户看到的画面
```

如果 JS 执行（比如 React 渲染）占用了超过 16.6ms，浏览器就**跳过一帧**，用户感知到卡顿。

**React 15 的问题**：Stack Reconciler 是递归的，一旦开始渲染，必须一口气走完整棵树。如果组件树很大，主线程被长时间阻塞。

**React 16+ 的解法**：把大渲染任务拆成小片，每片执行完后检查"是否还有时间"，没有就让出主线程。

---

## 二、Scheduler：React 的通用调度器

React 把调度逻辑抽成了独立的 `scheduler` 包，它**不依赖 React**，可以单独使用。

### 2.1 最小堆优先级队列

Scheduler 内部维护一个**最小堆**（Min Heap），按任务的过期时间排序：

```js
// 简化版任务结构
const task = {
  id: taskIdCounter++,
  callback,           // 实际执行的工作函数
  priorityLevel,      // 优先级
  startTime,          // 任务创建时间
  expirationTime,     // 过期时间 = startTime + timeout
  sortIndex: -1,      // 在堆中的排序键（通常是 expirationTime）
};
```

堆操作的时间复杂度：
- `push`（插入）：O(log n)
- `peek`（看堆顶）：O(1)
- `pop`（取出最小）：O(log n)

### 2.2 五种优先级

```js
// 源码中的优先级定义（数值越小优先级越高）
var ImmediatePriority = 1;      // 立即执行，同步阻塞
var UserBlockingPriority = 2;   // 用户交互（点击、输入）
var NormalPriority = 3;         // 普通更新（setState）
var LowPriority = 4;            // 低优先级（如数据分析）
var IdlePriority = 5;           // 空闲时执行，永不过期
```

对应的 `timeout`（过期时间窗口）：

| 优先级 | timeout | 场景 |
|--------|---------|------|
| Immediate | -1 | 同步渲染，立即过期 |
| UserBlocking | 250ms | 用户点击、输入，必须快速响应 |
| Normal | 5000ms | 普通 setState |
| Low | 10000ms | 不紧急的后台任务 |
| Idle | 最大正整数 | 空闲时再做，比如日志上报 |

### 2.3 调度的核心循环

```js
function unstable_scheduleCallback(priorityLevel, callback, options) {
  var currentTime = getCurrentTime();
  var startTime = currentTime;
  
  // 根据优先级计算过期时间
  var timeout;
  switch (priorityLevel) {
    case ImmediatePriority: timeout = IMMEDIATE_PRIORITY_TIMEOUT; break;
    case UserBlockingPriority: timeout = USER_BLOCKING_PRIORITY_TIMEOUT; break;
    case NormalPriority: timeout = NORMAL_PRIORITY_TIMEOUT; break;
    case LowPriority: timeout = LOW_PRIORITY_TIMEOUT; break;
    case IdlePriority: timeout = IDLE_PRIORITY_TIMEOUT; break;
  }
  
  var expirationTime = startTime + timeout;
  
  var newTask = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: expirationTime,
  };
  
  // 推入最小堆
  push(timerQueue, newTask);
  
  // 请求调度
  if (!isHostCallbackScheduled) {
    isHostCallbackScheduled = true;
    requestHostCallback(flushWork);
  }
  
  return newTask;
}
```

### 2.4 时间切片：flushWork 与 workLoop

```js
function flushWork(hasTimeRemaining, initialTime) {
  isHostCallbackScheduled = false;
  
  // 先把过期的任务从 timerQueue 移到 taskQueue
  if (isHostTimeoutScheduled) {
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }
  
  isPerformingWork = true;
  var previousPriorityLevel = currentPriorityLevel;
  
  try {
    return workLoop(hasTimeRemaining, initialTime);
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
  }
}
```

**workLoop** 是调度的核心：

```js
function workLoop(hasTimeRemaining, initialTime) {
  var currentTime = initialTime;
  advanceTimers(currentTime);  // 把到期的 timer 移到 taskQueue
  currentTask = peek(taskQueue);
  
  while (currentTask !== null) {
    // 如果任务还没过期，但时间片用完了，先放一放
    if (currentTask.expirationTime > currentTime 
        && (!hasTimeRemaining || shouldYieldToHost())) {
      break;
    }
    
    // 执行任务
    var callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;
      currentPriorityLevel = currentTask.priorityLevel;
      
      var didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      var continuationCallback = callback(didUserCallbackTimeout);
      
      if (typeof continuationCallback === 'function') {
        // 任务没做完，返回了 continuation，继续调度
        currentTask.callback = continuationCallback;
      } else {
        // 任务完成，从队列移除
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
    } else {
      pop(taskQueue);
    }
    
    currentTask = peek(taskQueue);
  }
  
  // 如果还有任务，继续调度下一帧
  if (currentTask !== null) {
    return true;
  } else {
    return false;
  }
}
```

---

## 三、让出主线程：MessageChannel 与 shouldYield

### 3.1 为什么不用 setTimeout？

`setTimeout(fn, 0)` 实际上有 **4ms 的最小延迟**（HTML5 规范），而且嵌套调用时延迟会累积。React 需要更精确的"下一帧立即执行"。

### 3.2 MessageChannel

React 使用 `MessageChannel` 来实现宏任务调度：

```js
const channel = new MessageChannel();
const port = channel.port2;

// 浏览器渲染完成后，执行回调
channel.port1.onmessage = performWorkUntilDeadline;

function requestHostCallback(callback) {
  scheduledHostCallback = callback;
  port.postMessage(null);  // 触发 onmessage，在宏任务中执行
}
```

**执行时机**：
- `MessageChannel` 的回调是**宏任务**
- 它在当前事件循环的微任务之后、下一帧的浏览器渲染之前执行
- 这样 React 可以在浏览器绘制完一帧后，立即开始工作

### 3.3 shouldYieldToHost：时间片的判断

```js
const frameInterval = 5; // 每片工作最多 5ms

function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    return false; // 还有时间，继续干
  }
  return true; // 时间片用完，让出主线程
}
```

**为什么是 5ms？**

React 团队测试发现：
- 如果每片工作 < 5ms，用户交互的响应时间可以控制在 100ms 以内（人类感知"即时"的阈值）
- 如果 > 5ms，快速连续输入（如打字）会出现可感知的延迟

---

## 四、Lane 模型：React 内部的优先级位运算

Scheduler 是通用调度器，但 React 内部还需要更细粒度的优先级控制——**Lane 模型**。

### 4.1 为什么不用 Expiration Time 了？

React 17 之前用 `expirationTime`（过期时间戳）表示优先级：
- 数字越小，优先级越高
- 问题是**优先级是线性的**，只能表达"谁先谁后"

React 18 的并发特性需要**多个优先级同时存在**：
- 用户输入（高优先级）和 Transition（低优先级）可能同时发生
- 需要能"提取"某一优先级的更新，而不影响其他优先级

### 4.2 Lane 的位掩码设计

```js
// 一个 31 位的整数，每一位代表一种 Lane
export const NoLanes: Lanes = /*                       */ 0b0000000000000000000000000000000;
export const SyncLane: Lane = /*                       */ 0b0000000000000000000000000000001;
export const InputContinuousHydrationLane: Lane = /*   */ 0b0000000000000000000000000000010;
export const InputContinuousLane: Lane = /*            */ 0b0000000000000000000000000000100;
export const DefaultHydrationLane: Lane = /*           */ 0b0000000000000000000000000001000;
export const DefaultLane: Lane = /*                    */ 0b0000000000000000000000000010000;
export const TransitionHydrationLane: Lane = /*        */ 0b0000000000000000000000000100000;
export const TransitionLane1: Lane = /*                */ 0b0000000000000000000000001000000;
export const TransitionLane2: Lane = /*                */ 0b0000000000000000000000010000000;
// ... TransitionLane3-16
export const IdleLane: Lane = /*                       */ 0b0100000000000000000000000000000;
export const OffscreenLane: Lane = /*                  */ 0b1000000000000000000000000000000;
```

### 4.3 Lane 的位运算操作

```js
// 合并多个 Lane（按位或）
const lanes = SyncLane | DefaultLane;  
// 0b0000000000000000000000000000001 | 0b0000000000000000000000000010000
// = 0b0000000000000000000000000010001

// 检查是否包含某个 Lane（按位与）
if (lanes & SyncLane) {
  // 包含 SyncLane
}

// 移除某个 Lane（按位与 + 取反）
lanes &= ~SyncLane;

// 提取最高优先级 Lane（获取最低位的 1）
function getHighestPriorityLane(lanes) {
  return lanes & -lanes;  // 经典位运算技巧
}
// 0b0010100 & -0b0010100 = 0b0000100
```

### 4.4 为什么 Transition 有 16 个 Lane？

```js
export const TransitionLane1 = /* */ 0b0000000000000000000000001000000;
export const TransitionLane2 = /* */ 0b0000000000000000000000010000000;
// ...
export const TransitionLane16 = /* */ 0b0001000000000000000000000000000;
```

**原因**：多个 Transition 更新可能同时发生，如果只有一个 Transition Lane，它们会互相阻塞。16 个 Lane 允许**并发的 Transition 更新共存**。

### 4.5 Lane 与 Scheduler 的衔接

Lane 模型决定**"做什么"**，Scheduler 决定**"什么时候做"**：

```
Lane 模型（React 内部）
    ↓
确定本次渲染要处理哪些 Lanes（getNextLanes）
    ↓
把渲染任务交给 Scheduler（ensureRootIsScheduled）
    ↓
Scheduler 根据优先级安排执行时机
    ↓
执行时通过 shouldYield 检查时间片
    ↓
如果中断，保存当前工作进度（workInProgress）
    ↓
下次调度时恢复（performConcurrentWorkOnRoot）
```

---

## 五、批处理：Automatic Batching

### 5.1 React 18 之前的批处理

React 17 及之前，只有在 React 事件处理函数中的 `setState` 才会被批处理：

```js
function handleClick() {
  setCount(c => c + 1);  // 不立即执行
  setFlag(f => !f);      // 不立即执行
  // 函数结束后，两个 setState 合并成一次渲染
}
```

但在 setTimeout、Promise、原生事件回调中，每个 `setState` 会**立即触发一次渲染**：

```js
setTimeout(() => {
  setCount(c => c + 1);  // 立即渲染一次
  setFlag(f => !f);      // 又立即渲染一次
  // 两次渲染！
}, 0);
```

### 5.2 React 18 的自动批处理

React 18 引入了 **Automatic Batching**，所有场景下的 `setState` 都会被自动批处理：

```js
setTimeout(() => {
  setCount(c => c + 1);  // 不立即执行
  setFlag(f => !f);      // 不立即执行
  // 函数结束后，合并成一次渲染
}, 0);
```

**实现原理**：

React 18 重写了事件系统的入口，在**任何可能触发更新的代码执行前后**包裹 `batchedUpdates`：

```js
// 简化版
function batchedUpdates(fn, a) {
  var previousIsBatchingUpdates = isBatchingUpdates;
  isBatchingUpdates = true;
  try {
    return fn(a);
  } finally {
    isBatchingUpdates = previousIsBatchingUpdates;
    if (!isBatchingUpdates && !isRendering) {
      // 执行累积的更新
      performSyncWorkOnRoot();
    }
  }
}
```

在 React 18 中，这个批处理是**自动的、全局的**，通过 `createRoot` 的启用：

```js
// React 18
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);  // 自动启用并发特性 + 自动批处理
```

---

## 六、并发特性如何依赖调度系统

### 6.1 useTransition

```js
const [isPending, startTransition] = useTransition();

startTransition(() => {
  setQuery(newQuery);  // 标记为 TransitionLane（低优先级）
});
```

**底层流程**：

1. `startTransition` 内部调用 `requestUpdateLane`，返回一个 **TransitionLane**
2. `setQuery` 产生的更新被标记为这个 Lane
3. `ensureRootIsScheduled` 发现当前有 TransitionLane 更新
4. 调度器把它作为**低优先级任务**放入队列
5. 如果此时有用户输入（高优先级），会**插队**先处理
6. Transition 的渲染可以被中断、恢复、甚至丢弃（如果新的 Transition 又来了）

### 6.2 useDeferredValue

```js
const deferredQuery = useDeferredValue(query);
```

**原理**：
- `query` 变化时，React 先用旧值 `deferredQuery` 渲染一次（高优先级）
- 然后用新值 `query` 在后台渲染（低优先级，TransitionLane）
- 后台渲染完成后，再替换显示

这依赖 Lane 模型的**优先级插队**机制。

---

## 七、调度系统的全景图

```
┌─────────────────────────────────────────────────────────────┐
│                         用户交互                             │
│     点击 / 输入 / setState / startTransition / ...           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      更新产生更新队列                         │
│              updateQueue → 每个 update 带 Lane               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   ensureRootIsScheduled                       │
│         获取 nextLanes → 决定同步还是并发渲染                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
              SyncLane              Concurrent
         (performSyncWork)      (performConcurrentWork)
                    ↓                   ↓
              立即执行              交给 Scheduler
                                        ↓
                              ┌─────────────────┐
                              │   最小堆队列     │
                              │  按过期时间排序   │
                              └─────────────────┘
                                        ↓
                              ┌─────────────────┐
                              │  MessageChannel │
                              │   宏任务调度     │
                              └─────────────────┘
                                        ↓
                              ┌─────────────────┐
                              │   workLoop      │
                              │  shouldYield?   │
                              │  是 → 中断保存   │
                              │  否 → 继续执行   │
                              └─────────────────┘
                                        ↓
                              ┌─────────────────┐
                              │   Commit Phase  │
                              │   (不可中断)     │
                              └─────────────────┘
```

---

## 八、面试架构师级问题

### Q1: "Scheduler 用最小堆而不是数组或链表，为什么？"

**答**：Scheduler 需要频繁地**取出最高优先级任务**（堆顶）和**插入新任务**。最小堆的 `peek` 是 O(1)，`push/pop` 是 O(log n)。如果用排序数组，插入是 O(n)；用链表，查找插入位置是 O(n)。最小堆是权衡后的最优解。

### Q2: "为什么时间切片是 5ms？如果改成 10ms 会怎样？"

**答**：5ms 是 React 团队根据用户体验研究定的。人类感知"即时响应"的阈值约 100ms，5ms 的时间片保证了即使多个任务排队，总延迟也在可接受范围内。如果改成 10ms，快速连续输入（如打字）可能出现可感知的卡顿。

### Q3: "Lane 模型相比 Expiration Time，最大的工程优势是什么？"

**答**：Expiration Time 是线性优先级，只能表达"谁先谁后"。Lane 是位掩码，可以**同时表达多个优先级**、**批量提取同一优先级的更新**、**合并和拆分更新**。这是 React 18 并发特性（useTransition、Suspense 选择性水合）的底层基础。

### Q4: "React 18 的自动批处理，在底层是怎么实现的？"

**答**：React 18 通过 `createRoot` 启用了新的渲染入口，它在所有可能触发更新的代码执行路径上都隐式包裹了 `batchedUpdates`。无论更新来自 React 事件、setTimeout、Promise 还是原生事件，都会被收集到同一个批处理周期内，在事件循环的微任务阶段统一刷新。

### Q5: "如果 shouldYield 返回 true，React 怎么保证下次能从断点恢复？"

**答**：中断时，`workInProgress` 树和当前的 `workInProgress` 指针被保留在内存中。下次调度时，`performConcurrentWorkOnRoot` 会检查 `workInProgress` 是否存在，如果存在就从上次中断的 Fiber 节点继续 `workLoopConcurrent`。

---
