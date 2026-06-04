# Stability Patterns：Retry + Timeout + Circuit Breaker

## 目标

训练后端稳定性三件套的组合设计与实现。面试和工程中，"重试""超时""熔断"总是同时出现，但组合顺序和边界处理决定系统的真实可靠性。

## 场景

你的服务依赖下游 API，面临三类问题：
- **瞬时故障**：网络抖动、下游 GC 导致偶发超时 → 需要 **Retry**
- **无限等待**：下游挂死、连接池耗尽 → 需要 **Timeout**
- **持续故障**：下游完全不可用，重试会放大故障 → 需要 **Circuit Breaker**

## 核心考点

- 退避策略：固定间隔 vs 指数退避 vs 指数退避 + jitter
- 超时层级：单次 attempt 超时 vs 总超时
- 熔断状态机：closed → open → half-open → closed 的完整流转
- 组合顺序：CB 在外层，retry 包 timeout，每次重试独立计时
- 可重试错误分类：5xx 可重试、4xx 不可重试、超时/网络错误可重试

## 边界条件

- **Retry**：maxAttempts = 1 时不重试；backoff 返回 0 时立即重试；非重试错误立即抛出不等待
- **Timeout**：超时后原 Promise 仍继续运行，但结果已被忽略；支持 AbortSignal 联动取消
- **Circuit Breaker**：
  - closed 状态成功时重置失败计数
  - open 状态下所有调用快速失败
  - half-open 只允许一个探测调用，防止流量突增压垮恢复中的服务
  - resetTimeoutMs 必须大于下游真实恢复时间，否则反复 half-open → open 震荡

## 实现思路

### Retry
1. `for` 循环执行 `fn()`，最多 `maxAttempts` 次
2. 成功直接 return
3. 失败时检查 `retryable(error)`，不可重试立即抛出
4. 可重试则等待 `backoff(attempt)` 毫秒，继续下一次
5. 最后一次失败抛出原始错误，保留堆栈

### Timeout
1. `Promise.race` 的替代实现：手动管理 timer 和 cleanup
2. 用 `setTimeout` 创建延时 reject
3. 原 Promise 完成时 `clearTimeout`，防止内存泄漏
4. 支持 `AbortSignal`：已 aborted 立即 reject，执行中 abort 也立即 reject

### Circuit Breaker
1. 维护 `state`、`failures`、`lastFailureTime`、`halfOpenInProgress`
2. `execute` 入口根据状态决定：执行 / 快速失败 / 进入 half-open
3. 成功回调 `onSuccess`：half-open → closed，或 closed 重置计数
4. 失败回调 `onFailure`：计数+1，达到阈值 → open；half-open 失败直接 → open
5. 时间判断：`Date.now() - lastFailureTime >= resetTimeoutMs`

### 推荐组合
```
CircuitBreaker.execute(() =>
  withRetry(
    () => withTimeout(businessFn(), perAttemptTimeoutMs),
    retryOptions
  )
)
```

- **为什么 CB 在最外层？** 熔断器需要观察"重试后的最终结果"，如果重试仍然失败，说明下游真实不可用。
- **为什么 timeout 在 retry 内层？** 每次重试都需要独立的超时计时，否则第一次超时就会耗尽总时间。

## 复杂度

- **Retry**：时间 O(attempts × fn 耗时 + Σbackoff)，空间 O(1)
- **Timeout**：时间 O(1)，空间 O(1)（一个 timer）
- **Circuit Breaker**：时间 O(1)，空间 O(1)

## 面试追问

- 如果下游是幂等的才能重试，怎么保证？（答：在 `retryable` 里判断 HTTP method + 业务幂等键；真正的幂等需要在 `data-consistency/` 里用 idempotency key 实现。）
- 指数退避会不会导致恢复太慢？（答：配 maxMs 上限；或采用断路器优先策略，熔断期间完全不重试。）
- 半开状态只允许一个请求探测，如果那个请求本身就超时了，怎么判断是下游没恢复还是探测请求运气不好？（答：探测超时视为失败，重新 open；可配多次探测成功才 closed。）
- 如何在微服务里共享熔断器状态？（答：单实例用内存状态；多实例用 Redis / 分布式缓存同步状态计数，或让负载均衡器做健康检查摘除。）

## 工程迁移

- **Axios / Fetch**：`axios-retry`、`fetch-retry` 的底层就是本实现的变体
- **gRPC**：gRPC 内置 exponential backoff 和 deadline（timeout）
- **Resilience4j / Polly**：Java / Python 的成熟库，状态机和本实现一致
- **Kubernetes**：readiness probe 失败摘除 Pod，和 CB 的 open 状态等价
