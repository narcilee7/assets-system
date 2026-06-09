# Node.js Observability

## 栈

| 能力 | 工具 |
| --- | --- |
| Logging | pino、winston |
| Metrics | prom-client、OpenTelemetry metrics |
| Tracing | OpenTelemetry、async_hooks context |
| Profiling | clinic.js、0x、inspector |
| Error Tracking | Sentry、Rollbar |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| pino request logger | `pino-logger/` | 结构化日志、请求级 traceId、脱敏、错误分级 |
| OpenTelemetry trace baseline | `opentelemetry-baseline/` | SDK 初始化、手动 Span、Trace-Aware Logger |
| event loop lag metric | *(见 `../performance/event-loop-lag`)* | perf_hooks + prom-client |
| heap snapshot playbook | *(见 `../performance`)* | clinic.js / 0x 分析 |
