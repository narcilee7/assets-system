# Review

## 我一开始容易写错什么

1. **retry 的 backoff 从 attempt 0 开始**：曾经混淆了 attempt 计数，导致第一次重试前没有等待或等待了 base×2。现在约定 `backoff(attempt)` 从 1 开始表示第 1 次重试前的延迟。
2. **timeout 后不清理 timer**：早期用 `Promise.race([promise, delayPromise])`，超时后原 promise 的 resolve 仍然可能触发 timer 回调的 reject，导致 unhandled rejection。改为手动管理 timer，原 promise 完成时主动 `clearTimeout`。
3. **circuit breaker 的 half-open 并发问题**：第一次实现时没有 `halfOpenInProgress` 锁，导致 half-open 状态下多个请求同时涌入，可能让恢复中的服务再次被打垮。
4. **组合顺序搞反**：曾经把 timeout 包在最外层，导致第一次 attempt 超时后就没有时间重试了。正确的顺序是 retry 在外层，每次 attempt 有独立的 timeout。

## 这个实现为什么成立

- **Retry 的核心是"可控的浪费"**：允许有限次数的重复调用，但用退避和可重试分类限制浪费范围。
- **Timeout 的核心是"止损"**：用 `clearTimeout` 保证资源不泄漏，用 `AbortSignal` 实现级联取消。
- **Circuit Breaker 的核心是"快速失败保护下游"**：open 状态下的快速失败比重试更有价值，因为它阻止了故障放大。
- **组合的顺序决定语义**：CB → Retry → Timeout 的嵌套关系，让每一层都只看到下一层的"最终结果"。

## 和标准库 / 框架实现的差距

| 特性 | 本实现 | Polly (C#) | Resilience4j (Java) | axios-retry |
|------|--------|------------|---------------------|-------------|
| 指数退避 + jitter | ✅ | ✅ | ✅ | ✅ |
| 单次超时 | ✅ | ✅ | ✅ | ❌（需额外配置） |
| 熔断状态机 | ✅（简化） | ✅ | ✅ | ❌ |
| 并发安全 half-open | ✅（单锁） | ✅ | ✅ | N/A |
| 多实例状态同步 | ❌ | ❌ | ❌ | N/A |
| 健康检查回调 | ❌ | ✅ | ✅ | N/A |
| Bulkhead / RateLimit | ❌ | ✅ | ✅ | ❌ |

- 生产环境如果需要更多弹性模式（隔离舱、限流、舱壁），应直接使用 Polly、Resilience4j 或 Go 的 `gobreaker`。
- Node.js 生态中，`cockatiel` 是最接近 Resilience4j 的库，可直接替换本实现用于生产。

## 工程里怎么取舍

- **单体服务 / 面试**：本实现足够表达核心概念，代码量控制在 200 行以内。
- **Node.js 生产**：用 `cockatiel`（微软出品），支持 retry、timeout、CB、bulkhead、cache 的声明式组合。
- **Java 生产**：Resilience4j 或 Spring Cloud Circuit Breaker，和监控体系（Micrometer）集成好。
- **Go 生产**：`github.com/sony/gobreaker` + `golang.org/x/sync/singleflight`，配合 context timeout。
- **是否要在每次 HTTP 调用都包 retry？** 不一定。客户端 SDK 通常自带重试；业务层只包 CB 和 timeout，避免重复退避导致延迟爆炸。

## 下次复习重点

1. 能现场写出 `withRetry`、`withTimeout`、`CircuitBreaker` 的核心逻辑，不依赖 IDE。
2. 能画出三种组合顺序的时序图，解释为什么 CB → Retry → Timeout 是最佳实践。
3. 能回答：如果 half-open 探测请求本身超时了，熔断器应该进入什么状态？（答：视为失败，回到 open，延长等待时间。）
4. 能把这套模式迁移到：gRPC deadline、Kubernetes probe、消息队列消费重试。
