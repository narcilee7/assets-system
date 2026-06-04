# Review

## 我一开始容易写错什么

1. **日志只打字符串，不打结构化数据**：早期习惯写 `console.log("User " + id + " failed")`，导致日志系统无法按字段过滤。改为 `logger.info("user failed", { userId: id })` 后，ELK / Loki 才能高效索引。
2. **用 `Date.now()` 做 metrics 直方图分位数**：曾经试图在记录时就计算 p99，结果数据不准确且无法回溯。正确做法是保留原始值或预分桶，查询时再计算。
3. **trace 上下文在异步回调中丢失**：在 `setTimeout` 或 `Promise.then` 里直接读取 `getCurrentTraceContext()` 返回 `undefined`，因为回调不在 `AsyncLocalStorage` 的上下文中。必须用 `withTrace` 包裹整个异步链。
4. **health check 里做真实业务查询**：曾经把数据库复杂查询放在 health check 里，导致探针超时、Pod 被反复重启。健康检查应该只做轻量级的 `SELECT 1` 或 ping。

## 这个实现为什么成立

- **StructuredLogger 的 `sink` 抽象**：把"格式化"和"输出"分离，测试时可以用内存数组捕获日志，生产时替换为文件或网络输出。
- **MetricsCollector 的简化 summary**：虽然生产用预分桶 histogram，但教学实现用原始值数组更直观，能直接看出延迟分布。
- **AsyncLocalStorage 的零侵入传播**：业务代码不需要手动传递 trace 上下文，`getCurrentTraceContext()` 自动拿到当前上下文，和 Java 的 `ThreadLocal`、Go 的 `context.Context` 等价。
- **HealthChecker 的异常兜底**：单个检查抛错不会中断其他检查，也不会让 health endpoint 本身 500，这是生产健康检查的关键防御。

## 和标准库 / 框架实现的差距

| 特性 | 本实现 | Pino | prom-client | OpenTelemetry |
|------|--------|------|-------------|---------------|
| 结构化日志 | ✅ | ✅（更快） | N/A | N/A |
| 日志级别 | ✅ | ✅ | N/A | N/A |
| Child logger | ✅ | ✅ | N/A | N/A |
| Counter / Histogram | ✅（简化） | N/A | ✅（预分桶） | N/A |
| p95/p99 计算 | ✅（排序） | N/A | ✅ | N/A |
| Trace 传播 | ✅（ALS） | N/A | N/A | ✅（标准 API） |
| 导出到 Prometheus | ❌ | N/A | ✅ | ❌ |
| 导出到 Jaeger | ❌ | N/A | N/A | ✅ |
| Health Check | ✅ | N/A | N/A | N/A |

- **Pino** 的日志性能是本实现的 10-100 倍，因为它用字符串拼接而不是 `JSON.stringify`，且支持 worker thread 卸载 IO。
- **prom-client** 的 Histogram 用预分桶（bucket）实现，summary 用滑动时间窗口，内存效率更高。
- **OpenTelemetry** 的 trace 支持跨进程传播（HTTP header 注入/提取），本实现只覆盖单进程。

## 工程里怎么取舍

- **教学 / 面试**：本实现完整展示概念，代码量适中，可现场手写。
- **Node.js 生产日志**：用 Pino + `pino-pretty`（开发）/ `pino-elasticsearch`（生产）。
- **Node.js 生产指标**：用 `prom-client` + `/metrics` endpoint，配合 Grafana 告警。
- **Node.js 生产追踪**：用 OpenTelemetry + Jaeger/Tempo，自动拦截 HTTP / DB 调用。
- **Health Check**：NestJS Terminus 是最佳选择，内置了 TypeORM、Prisma、Redis、RabbitMQ 的检查器。
- **性能敏感场景**：避免在热路径频繁创建 child logger 或记录大对象；可采样日志（sample 1%）降低开销。

## 下次复习重点

1. 能现场写出 `StructuredLogger` + `MetricsCollector` + `withTrace` 的核心逻辑。
2. 能解释 `AsyncLocalStorage` 如何在 Node.js 事件循环中保持上下文。
3. 能画出可观测性数据流：业务代码 → Logger/Metrics/Trace → Collector → Storage → Dashboard/Alert。
4. 能快速回答：liveness 失败重启 Pod，readiness 失败摘除流量，startup 失败阻止容器启动。
