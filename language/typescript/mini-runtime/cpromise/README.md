# CPromise

## 目标

手写一个符合 Promise/A+ 规范的 Promise 状态机，训练异步执行模型、thenable 展开和组合 API 的设计。

## 场景

在无法直接使用原生 Promise 或需要理解其内部机制时，能够从零构建一个可运行的 Promise 实现，并覆盖静态方法（all / race / allSettled / any / try / defer）。

## 核心考点

- 状态机：pending → fulfilled / rejected，不可逆。
- 微任务：then 回调必须通过 queueMicrotask 异步执行。
- thenable 展开：resolve 的值可能是另一个 Promise 或 thenable，需要递归展开。
- 循环引用检测：promise 不能 resolve 自身。
- 静态方法组合：all、race、allSettled、any 的时序和边界。

## 边界条件

- 空数组：CPromise.all([]) 立即 resolve([])。
- 已经 settled 后再次调用 resolve / reject 应忽略。
- then 中 onFulfilled / onRejected 不是函数时透传值或抛出错误。
- finally 不改变值，但 reject 需要透传。

## 实现思路

1. 构造函数内立即执行 executor，捕获同步异常并 reject。
2. resolve 时检查 thenable，通过 resolvePromise 递归展开。
3. then 返回新 Promise，将回调包装后推入微任务或回调队列。
4. 静态方法基于 resolve + then 组合实现。

## 复杂度

- 时间复杂度：O(n) 对于 all / allSettled / any（n 为输入 Promise 数量）。
- 空间复杂度：O(n) 存储结果或错误。

## 面试追问

- 如果数据量扩大 100 倍，allSettled 的内存占用如何优化？
- 如果需要取消长时间运行的 Promise，如何设计 AbortController 集成？
- 如果要在 then 回调中支持 async generator，需要修改哪些部分？

## 工程迁移

- 在旧浏览器或受限运行时中提供 Promise polyfill。
- 将 Promise 状态机迁移到自定义任务调度器（如支持优先级的微任务队列）。
