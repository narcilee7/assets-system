# Event Loop Ordering Lab

理解 Node.js event loop 的时序是定位异步 Bug 的核心能力。

## 实验目标

- 验证 timers、poll、check、microtask、nextTick 的执行顺序。
- 观察 `setTimeout(0)` 与 `setImmediate()` 在不同上下文中的胜负。
- 理解 `process.nextTick` 为什么被称为 "伪微任务"。

## 核心代码

### 1. 基础时序实验

```js
// event-loop-order.js
console.log('1. script start');

setTimeout(() => console.log('2. setTimeout 0'), 0);
setImmediate(() => console.log('3. setImmediate'));
process.nextTick(() => console.log('4. nextTick'));
Promise.resolve().then(() => console.log('5. Promise microtask'));

console.log('6. script end');
```

**预期输出：**
```
1. script start
6. script end
4. nextTick
5. Promise microtask
2. setTimeout 0
3. setImmediate
```

**原理：**
- `nextTickQueue` 在当前 phase 结束后、进入下一 phase 前清空。
- `microtaskQueue`（Promise）在 `nextTickQueue` 之后、下一 phase 之前清空。
- `setTimeout(0)` 进入 timers phase，`setImmediate` 进入 check phase；在 I/O 回调内，setImmediate 通常先于 setTimeout(0)。

### 2. I/O 上下文中的 setTimeout vs setImmediate

```js
// io-context-race.js
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('A. setTimeout'), 0);
  setImmediate(() => console.log('B. setImmediate'));
  process.nextTick(() => console.log('C. nextTick'));
});
```

**预期输出：**
```
C. nextTick
B. setImmediate
A. setTimeout
```

> 在 I/O callback 内部，poll phase 结束后进入 check phase，因此 `setImmediate` 快于 `setTimeout(0)`。

### 3. nextTick 饥饿风险

```js
// nexttick-starvation.js
let count = 0;
function busyNextTick() {
  if (count++ < 5) {
    process.nextTick(busyNextTick);
    console.log('nextTick', count);
  }
}
busyNextTick();
setTimeout(() => console.log('setTimeout should not starve'), 0);
```

**结论：** 递归 `nextTick` 会阻塞 event loop，使 I/O 和 timers 无法执行。生产环境应改用 `setImmediate` 来让出循环。

## 运行

```bash
node event-loop-order.js
node io-context-race.js
node nexttick-starvation.js
```

## 架构师追问

- `nextTick` 和 `queueMicrotask` 的本质区别是什么？
- `Promise.then` 和 `nextTick` 哪个先执行？
- 为什么在 `fs.readFile` 回调里 `setImmediate` 比 `setTimeout(0)` 快？
- 如何检测 event loop 被阻塞？（见 `../performance/event-loop-lag-diagnosis`）
