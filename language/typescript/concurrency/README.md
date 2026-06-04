# Concurrency

这一层训练 JavaScript 的异步模型：Event Loop、Promise、async/await、AbortController、Async Iterator。

## 必会概念

- JavaScript 是单线程的，并发通过 Event Loop 实现。
- 微任务（microtask）优先于宏任务（macrotask）。
- Promise 是异步操作的单一值占位符，async/await 是 Promise 的语法糖。
- AbortController 提供统一的取消信号机制。
- Async Generator 提供异步数据流的原生支持。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| Event Loop 可视化 | `event-loop/` | todo | 调用栈、微任务、宏任务 |
| Promise 组合模式 | `promise-patterns/` | todo | all、race、allSettled、any、链式 |
| 取消信号与资源管理 | `abort-controller/` | todo | AbortSignal、fetch 取消、清理 |
| Async Generator | `async-iterator/` | todo | for-await-of、async generator |
| 微任务调度实验 | `scheduler/` | todo | queueMicrotask、setTimeout、requestAnimationFrame |
