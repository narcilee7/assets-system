# React Concurrent 模式

## 1. 时间切片（Time Slicing）

React 16 之前：所有更新同步执行，阻塞主线程。

React 18 Concurrent：将长任务切分为小块，利用浏览器的空闲时间执行。

```
帧 1 (16.67ms)                    帧 2 (16.67ms)
├─ 用户输入 ─┤                    ├─ 用户输入 ─┤
│            │                    │            │
│  React     │ 浏览器 paint       │  React     │ 浏览器 paint
│  work (5ms)│ (10ms)            │  work (5ms)│ (10ms)
│            │                    │            │
└────────────┘                    └────────────┘

React 15（同步）                  React 18（时间切片）
├──────────────────────────────┐  ├─ 输入 ─┤
│                              │  │        │
│  reconcile + commit          │  │ work 1 │ paint
│  (100ms 阻塞)                │  │ (5ms)  │
│                              │  │        │
│                              │  │ work 2 │ paint
│                              │  │ (5ms)  │
│                              │  │        │
│                              │  │ ...    │
└──────────────────────────────┘  └────────┘
```

## 2. Lane 优先级模型

React 用 **Lane**（二进制位）表示更新优先级：

```javascript
// Lane 优先级（值越小优先级越高）
const SyncLane = 0b0000000000000000000000000000001;   // 1
const InputContinuousHydrationLane = 0b0000000000000000000000000000010; // 2
const InputContinuousLane = 0b0000000000000000000000000000100; // 4
const DefaultHydrationLane = 0b0000000000000000000000000001000; // 8
const DefaultLane = 0b0000000000000000000000000010000; // 16
const TransitionHydrationLane = 0b0000000000000000000000000100000; // 32
const TransitionLane1 = 0b0000000000000000000000001000000; // 64
const TransitionLane2 = 0b0000000000000000000000010000000; // 128
const IdleLane = 0b0100000000000000000000000000000; // 最大

// Lane 的优势：用位运算快速合并和提取优先级
function mergeLanes(a, b) {
  return a | b;  // 位或运算
}

function includesSomeLane(set, subset) {
  return (set & subset) !== 0;  // 位与运算
}
```

### 更新来源与默认优先级

| 触发场景 | Lane | 优先级 |
|----------|------|--------|
| `flushSync` | SyncLane | 最高 |
| 用户输入（点击、输入） | InputContinuousLane | 高 |
| `useEffect` 回调 | DefaultLane | 中 |
| `startTransition` | TransitionLane | 低 |
| `useDeferredValue` | TransitionLane | 低 |
| `requestIdleCallback` | IdleLane | 最低 |

## 3. startTransition

```javascript
import { startTransition, useState } from 'react';

function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleChange = (e) => {
    const value = e.target.value;

    // 高优先级更新：输入框必须立即响应
    setQuery(value);

    // 低优先级更新：搜索结果可以延迟
    startTransition(() => {
      setResults(searchAPI(value));
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending ? <Spinner /> : <Results data={results} />}
    </>
  );
}
```

**原理**：`startTransition` 将内部的 `setState` 标记为 **TransitionLane**，优先级低于普通更新。如果期间有更高优先级的更新（如用户继续输入），Transition 更新会被**中断**。

## 4. useDeferredValue

```javascript
function SlowList({ text }) {
  // 延迟渲染的值
  const deferredText = useDeferredValue(text);

  // text 变化时，先渲染旧值（保持 UI 响应）
  // 等浏览器空闲时，再渲染新值
  return (
    <ul>
      {heavyComputation(deferredText).map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

`useDeferredValue` vs `startTransition`：

| 特性 | useDeferredValue | startTransition |
|------|------------------|-----------------|
| 使用位置 | 在子组件中包装 props/state | 在事件处理函数中 |
| 适用场景 | 父组件快速更新，子组件慢渲染 | 状态更新本身较重 |
| 内部实现 | 内部调用 startTransition | 直接标记 lane |

## 5. useTransition

```javascript
function UpdateButton() {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      setData(fetchNewData());
    });
  };

  return (
    <button onClick={handleClick} disabled={isPending}>
      {isPending ? 'Loading...' : 'Update'}
    </button>
  );
}
```

`isPending` 表示是否有未完成的 Transition 更新，用于显示 loading 状态。

## 6. 可中断渲染的实现

```javascript
// 简化版：基于 MessageChannel 的调度器
const channel = new MessageChannel();
const port = channel.port2;

let scheduledCallback = null;
let startTime = 0;
const frameInterval = 5; // 每帧留给 React 的时间（ms）

function scheduleCallback(callback) {
  scheduledCallback = callback;
  port.postMessage(null);  // 触发宏任务
}

port.onmessage = function () {
  if (scheduledCallback) {
    const currentTime = performance.now();
    const hasTimeRemaining = currentTime - startTime < frameInterval;

    if (hasTimeRemaining) {
      // 还有时间，继续执行
      const hasMoreWork = scheduledCallback(hasTimeRemaining);
      if (hasMoreWork) {
        // 还有工作，继续调度
        port.postMessage(null);
      } else {
        scheduledCallback = null;
      }
    } else {
      // 没时间了，让出主线程，下一帧继续
      startTime = currentTime;
      port.postMessage(null);
    }
  }
};
```

React 实际使用的是 `MessageChannel`（或 `setImmediate` / `setTimeout` fallback），而不是 `requestIdleCallback`，因为：
1. `requestIdleCallback` 回调频率不稳定（可能几秒才触发一次）
2. `MessageChannel` 的宏任务在每帧的 paint 之后立即执行，更可控
