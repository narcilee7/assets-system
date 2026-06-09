# Monitoring & Observability

监控和可观测性覆盖指标、日志、链路追踪。

## 目录结构

```
monitoring-observability/
└── prometheus/     # Prometheus 监控
```

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Metrics | 数值型指标（CPU、内存、请求数） |
| Logs | 事件日志 |
| Traces | 请求链路追踪 |
| SLI | Service Level Indicator |
| SLO | Service Level Objective |

## 三个支柱

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Metrics    │    │     Logs     │    │    Traces    │
│              │    │              │    │              │
│ Prometheus   │    │    ELK       │    │    Jaeger    │
│ DataDog      │    │    Loki      │    │    Zipkin    │
│ CloudWatch   │    │    CloudWatch│    │    X-Ray     │
└──────────────┘    └──────────────┘    └──────────────┘
```

## 四个黄金信号

| 信号 | 测量方式 | 告警建议 |
| --- | --- | --- |
| Latency | P50/P95/P99 | P99 > 1s |
| Traffic | QPS | 异常波动 > 50% |
| Errors | 5xx 比例 | > 1% |
| Saturation | CPU/内存 | > 80% |

## 相关目录

- `prometheus/`：Prometheus 监控
- `../kubernetes/`：K8s 监控
- `../incident-management/`：告警响应