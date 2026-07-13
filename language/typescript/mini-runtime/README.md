# Mini Runtime

这一层把零散的类型机制组合成框架级理解：手写 Router、手写 ORM、手写 Agent Runtime、手写 Task Queue 等。

## 必会概念

- Promise 是状态机：pending → fulfilled / rejected，不可逆。
- Router 的核心是路径匹配、参数提取、中间件洋葱模型。
- ORM 的核心是模型定义、Query Builder、惰性执行。
- Agent Runtime 的核心是状态机 + 工具调用循环。
- Task Queue 的核心是并发控制、重试退避、优先级调度。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
|------|------|------|--------|
| 手写 Promise 状态机 | `cpromise/` | ready | thenable 展开、微任务、组合 API |
| 手写 Router + 参数提取 | `miniRouter.ts` | ready | 路径模板、中间件洋葱模型 |
| 手写 Fastify 风格框架 | `miniFastify.ts` | ready | schema 钩子、JSON 处理 |
| 手写 ORM + Query Builder | `miniORM.ts` | ready | 内存 CRUD、链式查询 |
| 手写 Test Runner | `miniTestRunner.ts` | ready | 测试收集、断言、异步支持 |
| 手写 Task Queue | `miniTaskQueue.ts` | ready | 并发控制、延迟、重试、优先级 |
| 手写 Agent Runtime | `miniAgentRuntime.ts` | ready | 状态机、工具注册、trace |
| 手写 TTL + LRU Cache | `miniCacheTTL.ts` | ready | 过期、LRU 驱逐、事件通知 |
| 手写 Scheduler | `miniScheduler.ts` | ready | 最小堆、一次性/周期任务 |
| 手写 Pub/Sub | `miniPubSub.ts` | ready | 通配符、异步订阅者隔离 |
| 手写 SSE Server | `miniSSE.ts` | ready | event-stream、广播、心跳 |

## 运行测试

```bash
cd language/typescript
npm test
```
