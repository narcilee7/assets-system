# Scalability

可扩展性训练容量评估、瓶颈定位和扩容方案。

## 核心维度

| 维度 | 关键问题 |
| --- | --- |
| Traffic | QPS、峰值、突刺、读写比 |
| Data | 数据量、增长、冷热分层 |
| Compute | CPU、I/O、并发、批处理 |
| Storage | 索引、分片、读写分离 |
| Cache | 命中率、热 key、失效策略 |
| Async | 队列、削峰、最终一致 |

## 资产

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| capacity estimation worksheet | todo | QPS、存储、带宽估算 |
| cache strategy design | todo | 本地缓存、分布式缓存 |
| async offloading design | todo | 同步链路拆异步 |
| hotspot mitigation | todo | 热 key、热点用户、热点分片 |

