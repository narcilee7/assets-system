# Distributed Systems

分布式系统训练跨节点协作时的基本约束。架构师要知道复杂度从哪里来，不能把网络当成本地调用。

## 核心主题

| 主题 | 关键问题 |
| --- | --- |
| CAP / PACELC | 一致性、可用性、延迟权衡 |
| Replication | 主从、同步、异步、延迟 |
| Partitioning | 分片键、热点、迁移 |
| Consensus | leader、quorum、选主 |
| Distributed Lock | 锁语义、过期、fencing token |
| Message Semantics | at-least-once、顺序、重复 |
| Clock / Ordering | 时间漂移、逻辑时钟、事件顺序 |

## 资产

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| distributed lock critique | todo | 什么时候不能靠锁解决 |
| message semantics worksheet | todo | 投递语义和业务幂等 |
| sharding strategy worksheet | todo | 分片键和热点治理 |
| leader election notes | todo | 选主和故障切换 |

