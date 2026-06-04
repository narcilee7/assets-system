# Review

## 我一开始容易写错什么

1. **忘记 `index` 指针防重入**：第一次实现时只递归 `dispatch(i + 1)`，没记录 `index`，导致重复调用 `next()` 会陷入无限递归。
2. **错误传播方向搞混**：曾经以为下游抛错会跳过上游的 after 逻辑。实际上 `await next()` reject 后，如果上游没有 try/catch，错误会向上传播；如果有 try/catch，after 逻辑仍然可以执行。
3. **没有处理 sync middleware**：如果中间件返回 void 而不是 Promise，直接用 `await fn()` 没问题，但用 `fn().then()` 会报错。必须用 `Promise.resolve(fn(...))` 统一。

## 这个实现为什么成立

- **洋葱模型的本质是递归**：每个中间件在 `next()` 前后各有一段代码，`next()` 内部是下一个中间件，天然形成"进入时顺序执行、返回时逆序执行"。
- **Promise 统一时序**：`Promise.resolve` 把 sync 和 async 拉到同一个异步语义里，保证无论中间件是否 `await`，执行顺序都正确。
- **提前绑定 vs 惰性执行**：`compose` 阶段只做校验和包装，真正的执行在调用 `composed(ctx, next)` 时才发生，这是函数式组合的关键。

## 和标准库 / 框架实现的差距

| 特性 | 本实现 | Koa compose | Express |
|------|--------|-------------|---------|
| 洋葱模型 | ✅ | ✅ | ❌（线性） |
| 防重入 | ✅ | ✅ | N/A |
| 错误冒泡 | ✅ | ✅ | 由 error handler 捕获 |
| 支持 sync/async | ✅ | ✅ | ✅ |
| 尾递归优化 | ❌ | ❌ | N/A |
| 超时控制 | ❌ | ❌ | N/A |
| Context 类型安全 | ✅（泛型） | ❌ | ❌ |

- Koa 的 `koa-compose` 实现几乎和本实现一致，也是用 `dispatch(i)` + `index` 指针。
- 生产环境如果需要更高性能，可以用循环代替递归（如 Fastify 的 avvio）。

## 工程里怎么取舍

- **小型服务 / 面试**：直接用本实现或 `koa-compose`，代码量少，语义清晰。
- **高并发服务**：Fastify 的 avvio 用循环 + 链表管理中间件，避免递归栈溢出。
- **类型安全优先**：NestJS 的 `MiddlewareConsumer` 结合 TypeScript 装饰器，编译期就能检查 Context 类型。
- **超时和熔断**：在生产中，pipeline 之上还要包 `timeout` 和 `circuit breaker`，这两个构件应该在 `reliability/` 中单独实现。

## 下次复习重点

1. 手写 `compose` 时不要漏掉 `index` 指针和 `Promise.resolve`。
2. 能现场画出 3 个中间件的洋葱执行顺序图。
3. 能快速迁移到：NestJS 拦截器、gRPC interceptor、测试 mock chain。
4. 对比 Express 线性模型和 Koa 洋葱模型的适用场景。
