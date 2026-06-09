# 前端监控工程化

前端监控工程化训练 —— 达到"能设计监控体系、能集成错误追踪、能分析性能数据"的水平。

## 训练哲学

1. **监控是产品的免疫系统**：上线前就要想好怎么知道它坏了。
2. **监控要分层**：错误（Error）→ 性能（Performance）→ 业务（Business），每层关注点不同。
3. **采样与降噪**：全量上报会压垮后端，必须设计合理的采样策略。
4. **Source Map 是生产调试的钥匙**：没有 Source Map，生产环境的错误堆栈就是天书。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-error-tracking.md](01-error-tracking.md) | 错误追踪：window.onerror、unhandledrejection、React/Vue 错误边界、Source Map |
| [02-performance-monitoring.md](02-performance-monitoring.md) | 性能监控：Web Vitals、自定义指标、Resource Timing、RUM |
| [03-logging-strategy.md](03-logging-strategy.md) | 日志策略：分级、采样、上报、去重、上下文关联 |
| [04-sdk-integration.md](04-sdk-integration.md) | SDK 集成工程化：Sentry 配置、source map 上传、隐私过滤、环境隔离 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/error-tracker.md](mini-impl/error-tracker.md) | 手写前端错误追踪 SDK |
| [mini-impl/performance-observer.md](mini-impl/performance-observer.md) | 手写性能监控收集器 |

## 监控体系全景

```
浏览器端                        服务端
┌─────────────────┐            ┌─────────────────┐
│  Error Capture  │───────────→│  Error Storage  │
│  - JS Error     │            │  - Grouping     │
│  - Promise      │            │  - Alerting     │
│  - Resource     │            │                 │
├─────────────────┤            ├─────────────────┤
│  Performance    │───────────→│  Metrics DB     │
│  - Web Vitals   │            │  - Dashboard    │
│  - Custom       │            │  - SLO Alert    │
│  - Resource     │            │                 │
├─────────────────┤            ├─────────────────┤
│  Business       │───────────→│  Analytics      │
│  - Page View    │            │  - Funnel       │
│  - Click        │            │  - Retention    │
│  - Conversion   │            │                 │
└─────────────────┘            └─────────────────┘
```
