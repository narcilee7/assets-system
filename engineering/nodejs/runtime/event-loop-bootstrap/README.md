# Node.js Event Loop 自举实现

这是一个从零用纯 JavaScript 实现的简化版 libuv event loop。它**不依赖** Node.js 内置的 `setTimeout`/`setImmediate`/`nextTick`/`queueMicrotask`，而是用自己的队列、phase 调度、drain 规则来驱动异步执行。

## 为什么要自举实现？

Node.js 的 event loop 由 C 语言编写的 libuv 驱动，隐藏在 V8 引擎之下。对于学习者来说：

- 只能观察行为，无法看到内部数据结构
- 无法验证 "nextTick 到底是在 poll phase 之后还是 check phase 之前清空"
- 无法理解 timers 的管理方式（不是简单的 FIFO 队列）

自举实现让我们可以：
- 打开黑盒，看到每个 phase 的执行过程
- 修改 drain 规则，验证不同策略的影响
- 在纯 JS 环境中教学，无需 C/C++ 知识

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        Event Loop                            │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Timers     │───>│  I/O Pending│───>│  Poll/Check │     │
│  │  (最小堆)    │    │  (FIFO队列)  │    │  (Immediate)│     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                                    │               │
│         └────────────────────────────────────┘               │
│                         │                                    │
│                    ┌─────────────┐                          │
│                    │ Close CBs   │                          │
│                    └─────────────┘                          │
│                                                              │
│  每个回调执行后:                                              │
│    1. drain nextTickQueue (递归)                             │
│    2. drain microtaskQueue (递归)                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. MinHeap（最小堆）

Timers 不是 FIFO 队列，而是按触发时间排序的优先队列。最小堆保证：
- `add(timer)` → O(log n)
- `peek()`（查看最早到期的 timer）→ O(1)
- `pop()`（取出并删除最早到期的 timer）→ O(log n)

这比线性扫描数组高效得多，尤其是在 timer 数量达到上千时。

### 2. Phase 队列

| Phase | 数据结构 | 说明 |
| --- | --- | --- |
| Timers | MinHeap | `setTimeout`/`setInterval`，按 `triggerAt` 排序 |
| Pending I/O | Array (FIFO) | 模拟的异步 I/O 回调队列 |
| Check | Array (FIFO) | `setImmediate` 回调 |
| Close | Array (FIFO) | 关闭事件的回调（如 socket 关闭） |

### 3. 微队列

| 队列 | 优先级 | 说明 |
| --- | --- | --- |
| `nextTickQueue` | 最高 | `process.nextTick` 注册到这里 |
| `microtaskQueue` | 次高 | `queueMicrotask` 和 `Promise.then` 注册到这里 |

**Drain 规则**（与真实 Node.js 完全一致）：
1. 每个 phase 回调执行后，先 drain `nextTickQueue`
2. `nextTick` 回调里可能再注册 `nextTick`，递归 drain 直到为空
3. 然后 drain `microtaskQueue`
4. `microtask` 回调里可能再注册 `microtask`，递归 drain 直到为空
5. 如果在 drain `microtask` 期间有新的 `nextTick` 被注册，先执行新 `nextTick`，再回来 drain `microtask`

## 与真实 Node.js Event Loop 的对比

| 维度 | 自举实现 | 真实 Node.js |
| --- | --- | --- |
| 语言 | JavaScript | C (libuv) + V8 |
| Timers 管理 | JS 最小堆 + `Date.now()` | libuv 最小堆 + 系统时钟 |
| I/O | 模拟（`simulateIO`） | 真正的 epoll/kqueue/IOCP |
| Poll Phase | 简化（无阻塞等待） | 阻塞等待 I/O 事件 |
| 多线程 | 无 | 线程池（文件系统、DNS） |
| 精度 | 毫秒级 | 纳秒级 |
| 适用 | 教学、验证 | 生产 |

## 运行 Demo

```bash
cd engineering/nodejs/runtime/event-loop-bootstrap
node demo.js
```

### Demo 1: 基础时序验证

验证 `nextTick` > `Promise` > `setTimeout(0)` > `setImmediate` 的顺序。

### Demo 2: I/O 上下文竞速

在 `simulateIO` 回调内部，`setImmediate` 快于 `setTimeout(0)`，与真实 Node.js 行为一致。

### Demo 3: nextTick 饥饿

递归 `nextTick` 会阻塞 timers 执行，展示为什么生产环境应避免递归 nextTick。

### Demo 4: 嵌套 Drain

验证 `Promise.then` 里注册 `nextTick`，以及 `nextTick` 里注册 `Promise` 的正确 drain 顺序。

### Demo 5: setInterval + clearTimeout

验证循环 timer 的重新入队机制和取消逻辑。

### Demo 6: 复杂混合场景

综合所有 queue 的交互，展示完整的 phase 流转。

## 作为模块使用

```js
const { EventLoop, bootstrapEventLoop, simulateIO } = require('./event-loop');

// 方式1: 使用 bootstrapEventLoop 替换全局 API
bootstrapEventLoop({ debug: true });

setTimeout(() => console.log('hello'), 100);
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));

// 模拟 I/O
simulateIO(() => console.log('io done'));

// 方式2: 直接使用 EventLoop 类（不替换全局 API）
const loop = new EventLoop();
loop.setTimeout(() => console.log('custom timer'), 50);
loop.run({ maxTicks: 20 });
```

## 扩展实验

### 修改 Phase 顺序

在 `event-loop.js` 中调整 `_runTimers`、`_runIOCallbacks`、`_runImmediates` 的调用顺序，观察对时序的影响。

### 修改 Drain 规则

将 `_drainNextTickAndMicrotask` 改为先 drain microtask 再 drain nextTick，对比输出差异：

```js
// 原实现（正确）：nextTick 先于 Promise
// 修改后（错误）：Promise 先于 nextTick
```

### 添加优先级队列

为 I/O callbacks 添加优先级字段，让某些 I/O 回调优先执行。

## 架构师级追问

- 为什么 nextTick 被称为 "伪微任务"，而不是真正的微任务？
- 如果 timers phase 执行了一个耗时 1s 的回调，期间到期的其他 timer 会怎样？
- 为什么 `setImmediate` 在 I/O 回调内部比 `setTimeout(0)` 快？
- `Promise.resolve().then()` 和 `queueMicrotask()` 在 Node.js 中是否完全等价？
- 为什么生产环境不能用递归 `process.nextTick`？
