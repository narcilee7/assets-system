# Observability Baseline

## 目标

训练后端服务的可观测性基线实现：结构化日志、指标聚合、追踪上下文传播、健康检查。面试中不只是背"三大支柱"，而是要能写出可运行的观测代码。

## 场景

你的服务上线后出了问题，你需要回答：
- **日志**：哪条请求失败了？错误发生在哪个函数？参数是什么？
- **指标**：QPS 多少？P99 延迟多少？错误率是否超过阈值？
- **追踪**：请求经过了多少个服务？哪个环节最慢？
- **健康**：进程还活着吗？能接收流量吗？依赖服务是否正常？

## 核心考点

- 日志必须结构化（JSON），不要只拼接字符串
- Metrics 要预聚合：counter + histogram，不是事后从日志里 grep
- Trace 必须跨异步边界传播：`AsyncLocalStorage` 是 Node.js 的标准方案
- Health Check 要区分 liveness（进程存活）和 readiness（可接受流量）
- 观测代码本身不能抛错，不能显著影响性能

## 边界条件

- **日志级别过滤**：debug 日志在生产环境应被静默，避免 IO 开销
- **child logger**：同一次请求的所有日志应共享 requestId / traceId
- **metrics 内存泄漏**：histogram 无限增长会 OOM，生产需定期汇总后清空
- **trace 上下文丢失**：如果用了 `setTimeout` 或 `Promise.then` 但没有在回调里恢复上下文，trace 会断链
- **health check 超时**：依赖检查不能阻塞太久，否则 K8s 会把 Pod 误判为不健康

## 实现思路

### StructuredLogger
1. 每条日志是一个 `LogEntry` 对象，包含 `timestamp`、`level`、`message` 和任意字段
2. `sink` 函数负责输出，默认 `JSON.stringify` + `console.log`
3. `child()` 方法创建子 logger，继承父级字段并合并新字段
4. 自动注入当前 `TraceContext`（通过 `AsyncLocalStorage`）

### MetricsCollector
1. `counter`：简单累加，适合记录请求数、错误数
2. `histogram`：记录原始值列表，适合延迟分布
3. `summary()` 计算 count / min / max / avg / p95 / p99
4. 教学实现用内存存储；生产环境应推送到 Prometheus / StatsD

### TraceContext
1. `traceId` 贯穿整个请求链路，`spanId` 标识当前阶段
2. `withTrace(ctx, fn)` 用 `AsyncLocalStorage.run()` 把上下文绑定到异步调用栈
3. 嵌套 trace 时，子 span 的 `parentSpanId` 指向父 span

### HealthChecker
1. 注册多个 `HealthCheckDefinition`，每个返回 `healthy` / `degraded` / `unhealthy`
2. `checkAll()` 遍历所有检查，取最差状态
3. `checkReadiness()` 只返回 `affectsReadiness !== false` 的检查（用于 K8s readinessProbe）
4. 单个检查抛错视为 `unhealthy`，不影响其他检查

### ObservableService（组合示例）
把 logger + metrics + trace + health 组合成一个基类，演示如何在真实业务函数中自动记录：
- 操作开始/结束日志
- 成功/失败计数
- 延迟 histogram
- trace 上下文注入

## 复杂度

- **Logger**：时间 O(1)，空间 O(1)（单次日志）
- **Metrics**：counter O(1)；histogram summary O(n log n)（因为排序）
- **Trace**：O(1) 开销（AsyncLocalStorage 由 V8 引擎优化）
- **Health**：O(m)（m 为检查数量）

## 面试追问

- 为什么不用 `console.log("user " + userId + " login")` 而用结构化日志？（答：结构化日志可被日志系统索引和聚合，`userId=42` 是独立字段，支持 `WHERE userId = 42` 查询。）
- Metrics 的 histogram 和 summary 有什么区别？（答：histogram 是客户端预分桶，适合 Prometheus；summary 是客户端计算分位数，适合 StatsD。本实现是简化版原始值列表。）
- `AsyncLocalStorage` 会不会有性能问题？（答：V8 优化后开销极低；但嵌套过深或频繁创建/销毁可能有影响，通常可忽略。）
- liveness 和 readiness 探针失败分别会导致什么？（答：liveness 失败 K8s 会重启 Pod；readiness 失败会把 Pod 从 Service 端点摘除，不接收新流量。）
- 如果依赖服务挂了，health check 应该返回 unhealthy 还是 degraded？（答：非核心依赖返回 degraded，核心依赖返回 unhealthy。）

## 工程迁移

- **Pino / Winston**：生产级 Node.js 日志库，都支持结构化输出和 child logger
- **Prometheus client**：`prom-client` 提供 Counter、Histogram、Summary，支持推送到 pushgateway
- **OpenTelemetry**：`@opentelemetry/api` 提供标准的 trace 上下文传播，和 Jaeger / Zipkin 集成
- **NestJS Terminus**：封装了 Health Check，支持 TypeORM、Mongoose、Redis 等内置检查器
- **K8s Probe**：`/health/live` 对应 livenessProbe，`/health/ready` 对应 readinessProbe
