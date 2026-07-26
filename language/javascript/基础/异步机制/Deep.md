# JavaScript 异步机制 — 浏览器与 Node.js 深度对比

---

## 一、事件循环的规范根基

ECMAScript 本身**没有定义事件循环**。它定义的是 **Job Queue（作业队列）** 概念，而事件循环是宿主环境（浏览器/Node.js）的实现。

> **规范级概念**：ECMAScript 将 Promise 回调等异步操作定义为 **Job**，要求宿主在"当前执行上下文栈清空后、控制权交还宿主前"执行 Job。这就是微任务的规范来源。

---

## 二、浏览器事件循环

### 1. 架构模型

```
┌─────────────────────────────────────────┐
│              调用栈 (Call Stack)         │
│         同步代码在此执行，后进先出         │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌───────────┐   ┌──────────┐
│ 微任务   │   │  宏任务    │   │ 渲染管线  │
│ Microtask│   │ Macrotask │   │ Render   │
│ Queue   │   │  Queue    │   │ Pipeline │
└─────────┘   └───────────┘   └──────────┘
```

### 2. 每轮事件循环（Event Loop Iteration）

**步骤**（WHATWG HTML 标准）：

1. **从宏任务队列取出一个最老的可运行任务**执行
2. **清空微任务队列**：执行所有微任务，若执行过程中又产生微任务，继续执行（直到微任务队列为空）
3. **更新渲染**（如果需要）：样式计算、布局、绘制（60fps 下约 16.6ms 一次）
4. 重复

### 3. 任务分类

**宏任务（Macrotask）**：

| 来源 | 说明 |
|-----|------|
| `setTimeout` / `setInterval` | 定时器回调 |
| `setImmediate` | IE/Edge 支持，浏览器非主流 |
| I/O（XHR、fetch 回调） | 网络请求完成 |
| UI 事件（click、scroll 等）| 用户交互 |
| `requestAnimationFrame` | 严格说不属于宏任务，在渲染阶段前执行 |
| `postMessage` / MessageChannel | 跨上下文通信 |

**微任务（Microtask）**：

| 来源 | 说明 |
|-----|------|
| `Promise.then/catch/finally` | Promise 回调 |
| `MutationObserver` | DOM 变动观察 |
| `queueMicrotask()` | 标准 API，直接入队微任务 |

### 4. 浏览器中的执行顺序

```javascript
console.log('1');

setTimeout(() => {
  console.log('2');
  Promise.resolve().then(() => console.log('3'));
}, 0);

Promise.resolve().then(() => {
  console.log('4');
  setTimeout(() => console.log('5'), 0);
});

console.log('6');

// 输出：1 → 6 → 4 → 2 → 3 → 5

// 拆解：
// 1. 同步：1, 6
// 2. 清空微任务：4（Promise.then）
// 3. 宏任务：2（setTimeout）
//    - 执行 2，产生微任务 3
//    - 宏任务执行完后清空微任务：3
// 4. 下一个宏任务：5（setTimeout 嵌套）
```

---

## 三、Node.js 事件循环

### 1. libuv 的 6 个阶段

Node.js 基于 libuv 实现事件循环，分为 6 个阶段，每个阶段维护一个 FIFO 队列：

```
┌──────────────────────────────────────┐
│           Node.js Event Loop          │
│                                       │
│   ┌──────────┐    ┌──────────────┐   │
│   │  timers  │───→│ pending I/O  │   │
│   │(setTimeout│    │  callbacks   │   │
│   │ setInterval)│   └──────────────┘   │
│   └──────────┘           │             │
│        ↑                 ▼             │
│   ┌──────────┐    ┌──────────────┐   │
│   │close     │←───│    poll      │   │
│   │callbacks │    │(获取新的 I/O  │   │
│   └──────────┘    │  事件; 执行  │   │
│        ↑          │ I/O 回调)    │   │
│   ┌──────────┐    └──────────────┘   │
│   │  check   │←──────────┘           │
│   │(setImmediate)                    │
│   └──────────┘                       │
│        ↑                             │
│   ┌──────────┐                       │
│   │idle,     │（内部使用）            │
│   │prepare   │                       │
│   └──────────┘                       │
│                                       │
│   每阶段结束后：清空 nextTickQueue     │
│   然后：清空 microtaskQueue            │
└──────────────────────────────────────┘
```

### 2. 各阶段详解

| 阶段 | 处理内容 |
|-----|---------|
| **timers** | 执行到期的 `setTimeout` / `setInterval` 回调。注意：定时器只是"最早可执行时间"，实际执行可能延迟 |
| **pending callbacks** | 执行系统操作的回调（如 TCP 错误）。部分 I/O 回调会延迟到下一轮 |
| **idle, prepare** | Node.js 内部使用 |
| **poll** | 核心阶段。检索新的 I/O 事件，执行 I/O 回调。若队列为空：检查是否有 timers 到期，有则回 timers；否则阻塞等待 I/O |
| **check** | 执行 `setImmediate` 回调 |
| **close callbacks** | 执行 `socket.on('close', ...)` 等关闭事件回调 |

### 3. Node.js 特有的优先级：`process.nextTick`

`process.nextTick` 不属于事件循环的任何阶段，它是一个独立的队列：

```
优先级：调用栈清空后 > process.nextTickQueue > microtaskQueue > 事件循环阶段
```

```javascript
Promise.resolve().then(() => console.log('microtask'));
process.nextTick(() => console.log('nextTick'));

// 输出：nextTick → microtask
// nextTick 优先级高于 Promise.then
```

**为什么存在 nextTick？**
- 设计意图：让开发者确保某些操作在当前操作完成后、事件循环继续前执行
- 风险：`nextTick` 递归调用会**饿死事件循环**（I/O 永远无法执行）

### 4. `setImmediate` vs `setTimeout(fn, 0)`

```javascript
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));

// 输出不确定！取决于调用时机

// 如果在 I/O 回调中调用：
const fs = require('fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  // 输出：immediate → timeout
  // 原因：I/O 回调在 poll 阶段执行，check 阶段紧接 poll
  // setImmediate 在 check 阶段，setTimeout 在 timers 阶段（下一轮）
});
```

**核心区别**：
- `setTimeout`：在 **timers 阶段**检查到期时间，至少下一轮循环
- `setImmediate`：在 **check 阶段**执行，当前循环的 poll 阶段之后

---

## 四、浏览器 vs Node.js 核心差异对比

| 维度 | 浏览器 | Node.js |
|-----|--------|---------|
| **实现基础** | 各浏览器自行实现（Blink/V8、SpiderMonkey 等）| libuv + V8 |
| **宏任务队列** | 单一队列（或按来源分优先级）| 6 个阶段，每阶段一个队列 |
| **微任务清空时机** | 每个宏任务执行后**立即清空所有微任务** | 每个阶段结束后清空微任务 |
| **`process.nextTick`** | ❌ 不存在 | ✅ 存在，优先级高于微任务 |
| **`setImmediate`** | ❌ 非主流（IE 支持）| ✅ check 阶段执行 |
| **I/O 模型** | 基于 Web APIs（网络、DOM）| 基于 libuv 线程池（文件、网络、DNS）|
| **UI 渲染** | 事件循环与渲染管线耦合 | 无 UI 渲染（纯后端）|
| **宏任务嵌套微任务** | 当前宏任务后的微任务阶段全部处理 | 当前阶段后的微任务阶段处理 |

### 关键差异示例

```javascript
// 这段代码在浏览器和 Node.js 中输出不同！
setTimeout(() => console.log('timer1'), 0);
setTimeout(() => {
  console.log('timer2');
  Promise.resolve().then(() => console.log('promise2'));
}, 0);
Promise.resolve().then(() => console.log('promise1'));

// 浏览器输出：
// promise1 → timer1 → timer2 → promise2
// （timer1 和 timer2 是两个独立的宏任务，每个宏任务后检查微任务）

// Node.js 输出（v11+ 与浏览器对齐前）：
// promise1 → timer1 → timer2 → promise2
// （v11+ 已改为与浏览器一致：timers 阶段执行所有到期 timer，然后清空微任务）
```

**Node.js v11 的重要变更**：
- v11 之前：timers 阶段执行一个回调，然后进入下一阶段
- v11 之后：timers 阶段执行**所有到期**的 timer 回调，然后统一清空微任务（与浏览器行为对齐）

---

## 五、Promise 深度 — A+ 规范与实现

### 1. Promise 的状态机

```
         new Promise((resolve, reject) => {})
                    │
                    ▼
              ┌─────────┐
              │ pending │
              └────┬────┘
         resolve()/fulfill()    reject()
              │                    │
              ▼                    ▼
        ┌──────────┐         ┌──────────┐
        │fulfilled │         │ rejected │
        │ (resolved)│        │          │
        └────┬─────┘         └────┬─────┘
             │                    │
             ▼                    ▼
        then(onFulfilled)    catch(onRejected)
```

**关键规则（A+ 规范）**：
1. 状态一旦改变（fulfilled/rejected），**不可再次改变**
2. `then` 必须返回一个新的 Promise（实现链式调用）
3. `onFulfilled` / `onRejected` 必须**异步执行**（微任务）
4. 值穿透：若 `onFulfilled` 不是函数，则透传上一个值

### 2. 手写 Promise（面试核心版）

```javascript
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class MyPromise {
  constructor(executor) {
    this.state = PENDING;
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];
    
    const resolve = (value) => {
      if (this.state === PENDING) {
        this.state = FULFILLED;
        this.value = value;
        this.onFulfilledCallbacks.forEach(fn => fn());
      }
    };
    
    const reject = (reason) => {
      if (this.state === PENDING) {
        this.state = REJECTED;
        this.reason = reason;
        this.onRejectedCallbacks.forEach(fn => fn());
      }
    };
    
    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }
  
  then(onFulfilled, onRejected) {
    // 值穿透：若 onFulfilled 不是函数，透传 value
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : v => v;
    onRejected = typeof onRejected === 'function' ? onRejected : err => { throw err; };
    
    const promise2 = new MyPromise((resolve, reject) => {
      const handleFulfilled = () => {
        setTimeout(() => {  // 模拟微任务（实际用 queueMicrotask）
          try {
            const x = onFulfilled(this.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (err) {
            reject(err);
          }
        }, 0);
      };
      
      const handleRejected = () => {
        setTimeout(() => {
          try {
            const x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (err) {
            reject(err);
          }
        }, 0);
      };
      
      if (this.state === FULFILLED) {
        handleFulfilled();
      } else if (this.state === REJECTED) {
        handleRejected();
      } else {
        this.onFulfilledCallbacks.push(handleFulfilled);
        this.onRejectedCallbacks.push(handleRejected);
      }
    });
    
    return promise2;
  }
  
  catch(onRejected) {
    return this.then(null, onRejected);
  }
  
  finally(onFinally) {
    return this.then(
      value => MyPromise.resolve(onFinally()).then(() => value),
      reason => MyPromise.resolve(onFinally()).then(() => { throw reason; })
    );
  }
  
  static resolve(value) {
    if (value instanceof MyPromise) return value;
    return new MyPromise(resolve => resolve(value));
  }
  
  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }
  
  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = [];
      let completed = 0;
      promises.forEach((p, i) => {
        MyPromise.resolve(p).then(
          value => {
            results[i] = value;
            completed++;
            if (completed === promises.length) resolve(results);
          },
          reject
        );
      });
    });
  }
  
  static race(promises) {
    return new MyPromise((resolve, reject) => {
      promises.forEach(p => MyPromise.resolve(p).then(resolve, reject));
    });
  }
}

// Promise 解决过程（A+ 规范核心）
function resolvePromise(promise2, x, resolve, reject) {
  if (promise2 === x) {
    reject(new TypeError('Chaining cycle detected'));
    return;
  }
  
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    let called = false;
    try {
      const then = x.then;
      if (typeof then === 'function') {
        // x 是 thenable
        then.call(
          x,
          y => {
            if (called) return;
            called = true;
            resolvePromise(promise2, y, resolve, reject);
          },
          r => {
            if (called) return;
            called = true;
            reject(r);
          }
        );
      } else {
        resolve(x);
      }
    } catch (err) {
      if (called) return;
      called = true;
      reject(err);
    }
  } else {
    resolve(x);
  }
}
```

---

## 六、async/await 的编译原理

### 1. async 函数的本质

`async` 函数是 **Generator + Promise** 的语法糖。

```javascript
async function foo() {
  const a = await 1;
  const b = await Promise.resolve(2);
  return a + b;
}

// Babel 编译后（简化版）：
function foo() {
  return _asyncToGenerator(function* () {
    const a = yield 1;
    const b = yield Promise.resolve(2);
    return a + b;
  })();
}

// 更底层的 Promise 展开：
function foo() {
  return new Promise((resolve, reject) => {
    const a = 1;
    // await 将后续代码包装为微任务
    Promise.resolve(a).then(val1 => {
      const b = Promise.resolve(2);
      Promise.resolve(b).then(val2 => {
        resolve(val1 + val2);
      }).catch(reject);
    }).catch(reject);
  });
}
```

### 2. await 的"暂停"机制

```javascript
async function test() {
  console.log('A');
  await Promise.resolve();
  console.log('B');
}
test();
console.log('C');

// 输出：A → C → B

// 拆解：
// 1. console.log('A') 同步执行
// 2. await Promise.resolve()：
//    - Promise.resolve() 已经是 resolved
//    - 但 await 仍然会将后续代码（console.log('B')）放入微任务队列
// 3. 继续执行同步代码 console.log('C')
// 4. 同步代码执行完毕，清空微任务队列，执行 console.log('B')
```

**关键规则**：
- `await` 后面的表达式会先求值
- 然后将其包装为 Promise（若已是 Promise 则复用）
- 将 `await` 之后的所有代码注册为该 Promise 的 `.then()` 回调
- 即使 `await` 的是已 resolved 的 Promise，后续代码也**至少延迟一个微任务**

### 3. async 函数中的错误处理

```javascript
async function mayFail() {
  throw new Error('fail');
}

// async 函数抛出的错误会 reject 返回的 Promise
mayFail().catch(err => console.log(err.message));

// await + try/catch
async function handle() {
  try {
    await mayFail();
  } catch (err) {
    console.log(err.message);
  }
}
```

---

## 七、Generator 与协程

### 1. Generator 的执行模型

Generator 是 JS 中**协程（Coroutine）**的实现，允许函数在执行过程中暂停和恢复。

```javascript
function* gen() {
  console.log('start');
  const a = yield 1;      // 暂停，返回 1
  console.log('got:', a);
  const b = yield 2;      // 暂停，返回 2
  console.log('got:', b);
  return 'done';
}

const g = gen();          // 创建生成器对象（不执行函数体）
g.next();                 // 执行到第一个 yield，返回 { value: 1, done: false }
g.next('A');              // 恢复执行，a = 'A'，执行到第二个 yield
g.next('B');              // 恢复执行，b = 'B'，返回 { value: 'done', done: true }
```

### 2. Generator 与异步

```javascript
// 基于 Generator 的异步流程控制（co 库原理）
function run(generator) {
  const g = generator();
  
  function next(value) {
    const result = g.next(value);
    if (result.done) return Promise.resolve(result.value);
    
    return Promise.resolve(result.value).then(
      val => next(val),
      err => g.throw(err)
    );
  }
  
  return next();
}

run(function* () {
  const a = yield fetch('/api/a');
  const b = yield fetch('/api/b');
  return [a, b];
});
```

**async/await 与 Generator 的关系**：
- `async` 函数 = 自动执行的 Generator
- `await` = `yield` + 自动 Promise 包装 + 自动 next() 调用
- async/await 是 Generator + Promise 的**语法糖 + 自动化**

---

## 八、高频输出题 — 浏览器与 Node 混合

### 题 1：浏览器环境

```javascript
console.log('1');

setTimeout(() => {
  console.log('2');
  Promise.resolve().then(() => console.log('3'));
}, 0);

Promise.resolve().then(() => {
  console.log('4');
  setTimeout(() => console.log('5'), 0);
});

console.log('6');

// 浏览器输出：1 → 6 → 4 → 2 → 3 → 5
```

### 题 2：Node.js 环境（v11+）

```javascript
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  Promise.resolve().then(() => console.log('promise'));
  process.nextTick(() => console.log('nextTick'));
});

// Node.js 输出：
// nextTick → promise → immediate → timeout

// 拆解：
// 1. fs.readFile 回调在 poll 阶段执行
// 2. 回调内同步注册：timer、immediate、promise、nextTick
// 3. 回调执行完毕，先清空 nextTick：nextTick
// 4. 再清空微任务：promise
// 5. poll 阶段结束，进入 check 阶段：immediate
// 6. 下一轮 timers 阶段：timeout
```

### 题 3：async/await 嵌套

```javascript
async function async1() {
  console.log('async1 start');
  await async2();
  console.log('async1 end');
}

async function async2() {
  console.log('async2');
}

console.log('script start');
setTimeout(() => console.log('setTimeout'), 0);
async1();
Promise.resolve().then(() => console.log('promise1'));
console.log('script end');

// 浏览器输出：
// script start → async1 start → async2 → script end → promise1 → async1 end → setTimeout

// 拆解：
// 1. script start（同步）
// 2. async1() 调用：console.log('async1 start') 同步执行
// 3. await async2()：async2() 同步执行，打印 async2；await 将后续代码（async1 end）放入微任务
// 4. script end（同步）
// 5. 同步代码结束，清空微任务：
//    - promise1（Promise.then）
//    - async1 end（await 的后续）
// 6. 宏任务 setTimeout
```

---

## 九、面试追问预判

**Q：Promise.then 是宏任务还是微任务？**
> 微任务。规范要求 Promise 回调作为 Job Queue 执行，宿主实现为微任务。

**Q：Node.js 中 `setImmediate` 和 `setTimeout(fn, 0)` 哪个先执行？**
> 取决于调用上下文。在主模块中直接调用，两者都在当前事件循环的后续阶段，执行顺序不确定（受进程性能影响）。在 I/O 回调中调用，`setImmediate` 先执行，因为 I/O 回调在 poll 阶段，紧接 check 阶段。

**Q：`await` 后面跟非 Promise 值会怎样？**
> 会被 `Promise.resolve()` 包装。即使跟的是原始值，后续代码也会作为微任务延迟执行。

**Q：为什么 `process.nextTick` 比 Promise.then 快？**
> Node.js 的设计中，nextTickQueue 是一个独立队列，在事件循环的任何阶段结束后、进入下一阶段前立即处理。而微任务队列在 nextTickQueue 之后处理。

**Q：如何确保一段代码在所有微任务之后、宏任务之前执行？**
> 浏览器中无法精确控制（微任务队列清空后才取宏任务）。Node.js 中可以用 `setImmediate`，但它在 check 阶段，某些情况下 timers 可能先执行。最可靠的是利用微任务链：`Promise.resolve().then(...)` 嵌套。

---

## 十、总结速查

| 概念 | 浏览器 | Node.js |
|-----|--------|---------|
| **事件循环** | 单队列宏任务 + 微任务队列 | libuv 6 阶段 |
| **微任务** | Promise、MutationObserver、queueMicrotask | Promise、queueMicrotask |
| **nextTick** | ❌ | ✅，优先级最高 |
| **setImmediate** | ❌（IE 除外）| ✅，check 阶段 |
| **I/O 回调** | Web APIs | libuv 线程池 |
| **每轮循环** | 一个宏任务 → 全部微任务 → 渲染 | 一个阶段 → nextTick → 微任务 → 下阶段 |

---
