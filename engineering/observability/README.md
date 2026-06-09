# 可观测性工程化

可观测性工程化训练 —— 达到"能设计 Metrics/Logs/Traces 三大支柱、能定义 SLO 驱动可靠性、能构建告警降噪体系"的水平。

## 训练哲学

1. **可观测性不是监控的别名**：监控告诉你系统坏了，可观测性让你理解为什么坏。
2. **三大支柱缺一不可**：Metrics 告诉你出了问题，Logs 告诉你问题的细节，Traces 告诉你问题在哪里。
3. **SLO 是产品的契约**：99.9% 的可用性不是技术目标，是对用户的承诺。
4. **告警 fatigue 是运维杀手**：宁可漏报，不可误报。每条告警都应该有明确的行动指引。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-observability-fundamentals.md](01-observability-fundamentals.md) | 可观测性基础：三大支柱、信号类型、可观测性 vs 监控、设计原则 |
| [02-metrics-system.md](02-metrics-system.md) | 指标系统：Prometheus、指标类型、RED/USE 方法、Grafana 可视化 |
| [03-logging-system.md](03-logging-system.md) | 日志系统：结构化日志、日志级别、ELK/Loki、日志收集与采样 |
| [04-distributed-tracing.md](04-distributed-tracing.md) | 分布式追踪：OpenTelemetry、Span/Trace、上下文传播、Jaeger |
| [05-alerting-slo.md](05-alerting-slo.md) | 告警与 SLO：SLO/SLI/SLA、告警规则设计、降噪、值班体系 |
| [06-profiling-debugging.md](06-profiling-debugging.md) | 性能分析：CPU/Memory Profiling、Flame Graph、Continuous Profiling |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/metrics-collector.md](mini-impl/metrics-collector.md) | 手写 Metrics 收集器（Counter/Histogram/Gauge） |
| [mini-impl/distributed-tracer.md](mini-impl/distributed-tracer.md) | 手写分布式追踪器（Span/Trace/Context 传播） |

## 可观测性决策树

```
问题类型？
  ├─ "系统是否健康？" → Metrics + Dashboard
  ├─ "发生了什么？" → Logs + 结构化查询
  ├─ "问题在哪里？" → Traces + 分布式追踪
  └─ "为什么慢？" → Profiling + Flame Graph

数据规模？
  ├─ < 1GB/天 → 单机存储足够
  ├─ 1GB - 100GB/天 → ELK / Prometheus + Thanos
  ├─ 100GB - 10TB/天 → ClickHouse / Loki / Tempo
  └─ > 10TB/天 → 自建 + 对象存储 + 采样

告警策略？
  ├─  symptoms-based（症状）→ 用户可见指标（错误率/延迟）
  └─  causes-based（原因）→ 系统指标（CPU/内存/磁盘）
  推荐：症状为主，原因为辅
```
