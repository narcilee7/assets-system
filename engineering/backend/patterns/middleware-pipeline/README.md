# Middleware Pipeline

## 目标

训练手写 Koa 风格的洋葱模型中间件管道。它是 Express / Koa / NestJS / Fastify 的底层核心机制，也是横切关注点（日志、认证、计时、错误处理）的载体。

## 场景

你正在设计一个 HTTP 框架或 RPC 处理层，需要让多个横切逻辑按顺序包裹业务逻辑，同时支持：
- 请求进入时的预处理（解析、鉴权、日志）
- 请求离开时的后处理（计时、响应头、清理）
- 错误在中间件间传播和恢复

## 核心考点

- 洋葱模型的执行顺序：before → next → after
- 错误传播：下游抛错 → 上游 `await next()` reject
- 边界：空数组、重复 `next()`、不调用 `next()`
- 异步统一：`Promise.resolve` 兼容 sync / async 中间件

## 边界条件

- **空中间件数组**：直接 resolve
- **重复调用 next()**：抛 `PipelineError`，防止无限递归
- **不调用 next()**：后续中间件不执行，已进入的中间件 after 逻辑不受影响
- **最外层 handler**：compose 支持传入最终的 root handler
- **非数组 / 非函数输入**：防御性校验，尽早抛错

## 实现思路

1. `compose(middlewares)` 返回一个新的 middleware 函数
2. 内部维护 `index` 指针，记录当前执行位置
3. `dispatch(i)` 递归调用第 i 个中间件，传入 `() => dispatch(i + 1)` 作为 `next`
4. 若 `i <= index`，说明 `next()` 被重复调用，抛错
5. 若 `i === middlewares.length`，则调用用户传入的最终 `next`（root handler）
6. 用 `Promise.resolve` 包裹中间件返回值，统一 sync / async

## 复杂度

- 时间复杂度：O(n)，n 为中间件数量，每个执行一次
- 空间复杂度：O(n)，递归调用栈深度

## 面试追问

- 如果中间件数量很大（比如 1000 个），递归会不会爆栈？（答：会。生产环境可用循环 + 手动栈模拟，或限制中间件数量。）
- 如何实现中间件级别的超时控制？（答：在 next() 上包 `Promise.race` + `setTimeout`。）
- 如何在一个中间件里只处理错误，不处理正常请求？（答：try/catch next()，只在 catch 分支做逻辑，正常路径透传。）
- Express 的 middleware 和 Koa 的洋葱模型有什么区别？（答：Express 是线性的，错误由专门的 error handler 捕获；Koa 是洋葱，错误沿调用栈向上冒泡。）

## 工程迁移

- **Koa / Express / Fastify**：理解这些框架的 `app.use()` 底层就是 compose
- **NestJS 拦截器**：`ExecutionContext` 和 `next.handle()` 是洋葱模型的变体
- **RPC / gRPC 拦截器**：UnaryInterceptor 同样基于 pipeline 模式
- **测试工具**：supertest、msw 的请求拦截也可以用 pipeline 思想实现
