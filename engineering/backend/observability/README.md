# Backend Observability

可观测性训练系统是否能被理解、定位和运营。架构师设计服务时必须同时设计观测面。

## 三大信号

| 信号 | 关注点 |
| --- | --- |
| Logs | request_id、user_id、error、business key |
| Metrics | QPS、latency、error rate、saturation |
| Traces | 跨服务调用、DB、cache、tool span |

## SLO

| 指标 | 示例 |
| --- | --- |
| Availability | 99.9% successful requests |
| Latency | p95 < 300ms |
| Freshness | event delay < 5s |
| Correctness | duplicate side effects = 0 |

## 资产

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| service observability baseline | todo | log / metric / trace 字段 |
| SLO worksheet | todo | SLI、SLO、error budget |
| incident debugging playbook | todo | 从报警到根因 |
| agent trace schema | todo | model、tool、retrieval spans |

