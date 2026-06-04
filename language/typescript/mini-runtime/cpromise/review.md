# Review

## 我一开始容易写错什么

1. **resolve 里忘记把 state 改成 FULFILLED**：ReImplement.ts 第 56 行就写成了 `this.state = PENDING`，导致状态机完全失效。
2. **then 的回调执行时机**：一开始直接同步执行，没有包在 queueMicrotask 里，违反了 Promise 的微任务语义。
3. **resolvePromise 的 called 标志**：第一次实现时漏掉了，导致 thenable 的 resolve 和 reject 都被调用。
4. **finally 的 reject 路径**：一开始只写了 `() => { throw reason }`，没有处理 callback 本身抛异常的情况。

## 这个实现为什么成立

- 状态机是不可逆的：只有在 PENDING 时才能转移状态，且通过 queueMicrotask 保证异步语义。
- thenable 展开符合 Promise/A+：通过递归 resolvePromise 处理嵌套 Promise，并检测循环引用。
- 所有静态方法都基于 `CPromise.resolve` 组合而成，保证了行为一致性。

## 和标准库 / 框架实现的差距

- 原生 Promise 由引擎内部优化微任务调度，而 CPromise 使用 queueMicrotask，在浏览器和 Node 中行为基本一致，但无法控制优先级。
- 没有实现 `Symbol.species`，在子类化场景下行为可能不同。
- 没有集成 V8 的调试信息（如 async stack trace）。

## 工程里怎么取舍

- 生产环境优先使用原生 Promise，手写版本仅用于学习或极度受限的嵌入式运行时。
- 如果需要可取消的异步操作，应在 API 层暴露 AbortSignal，而不是改造 Promise 状态机本身。

## 下次复习重点

1. 手写 resolvePromise 的完整逻辑（called 标志、循环检测、thenable 提取）。
2. 所有静态方法的边界条件（空数组、全 reject、时序）。
3. 对比 async/await 的语法糖如何在引擎层转换为 Promise 状态机。
