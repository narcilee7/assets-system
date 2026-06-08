# Frontend Observability

前端可观测性训练 —— 达到"能设计监控体系、能采集全量信号、能定位根因、能定义 SLO"的水平。

## 训练哲学

1. **三大支柱缺一不可**：Metrics 看趋势，Logs 查细节，Traces 跟链路。
2. **用户视角优先**：先监控用户体验指标（Web Vitals），再监控系统指标。
3. **信号 > 噪音**：合理采样、聚合、降噪，避免告警疲劳。
4. **可观测驱动开发**：在写功能时就想好"怎么监控它"。

## 体系索引

### 核心概念
| 文档 | 内容 |
|------|------|
| [01-observability-fundamentals.md](01-observability-fundamentals.md) | 可观测性三大支柱、信号分类、黄金信号、监控金字塔 |

### 信号采集
| 文档 | 内容 |
|------|------|
| [02-error-monitoring.md](02-error-monitoring.md) | 错误监控：异常捕获、source map、错误分类、聚合、降噪 |
| [03-performance-monitoring.md](03-performance-monitoring.md) | 性能监控：Web Vitals（LCP/INP/CLS/TTFB）、Performance API |
| [04-resource-monitoring.md](04-resource-monitoring.md) | 资源监控：加载时间、缓存命中率、CDN 效果、瀑布图 |
| [05-api-monitoring.md](05-api-monitoring.md) | API 监控：拦截、trace 传播、慢请求、失败率、重试 |
| [06-behavior-monitoring.md](06-behavior-monitoring.md) | 行为监控：点击、路由、会话、funnel、热力图、A/B |
| [07-logging.md](07-logging.md) | 日志管理：结构化日志、级别、采样、脱敏、前端日志库 |

### 链路追踪与告警
| 文档 | 内容 |
|------|------|
| [08-distributed-tracing.md](08-distributed-tracing.md) | 分布式追踪：OpenTelemetry、Trace ID、Span、W3C Trace Context |
| [09-alerting-slo.md](09-alerting-slo.md) | 告警与 SLO：阈值告警、异常检测、SLI/SLO、on-call 策略 |

### 平台与工具
| 文档 | 内容 |
|------|------|
| [10-cross-platform.md](10-cross-platform.md) | 跨平台可观测：WebView、React Native、小程序桥接监控 |
| [11-sentry-integration.md](11-sentry-integration.md) | Sentry 深度集成：release、source map、breadcrumbs、scope |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/monitor-sdk.md](mini-impl/monitor-sdk.md) | 手写前端监控 SDK：初始化、采集、上报、队列、降级 |
| [mini-impl/error-capture.md](mini-impl/error-capture.md) | 手写错误捕获：window.onerror、unhandledrejection、source map |
| [mini-impl/perf-observer.md](mini-impl/perf-observer.md) | 手写 Performance Observer：Web Vitals、长任务、资源加载 |

## 可观测性决策树

```
用户反馈页面有问题？
  ├─ 是 → 查看错误监控（Sentry）
  │       ├─ 有异常 → 查看堆栈、source map、复现路径
  │       └─ 无异常 → 查看性能监控（Web Vitals）
  │              ├─ LCP/INP/CLS 差 → 定位具体资源/长任务
  │              └─ 性能正常 → 查看行为监控（funnel/热力图）
  │
  └─ 否 → 看大盘趋势
          ├─ 错误率上升 → 查看最近发布、依赖变更
          ├─ 性能退化 → 对比版本、设备、地域
          └─ 业务指标跌 → 查看行为漏斗、A/B 实验
```
