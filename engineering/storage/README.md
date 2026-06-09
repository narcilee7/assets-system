# 存储工程化

存储工程化训练 —— 达到"能设计高可用存储架构、能处理海量数据分片、能保障数据一致性、能优化存储性能"的水平。

## 训练哲学

1. **存储是所有系统的根基**：数据丢失是不可逆的灾难，存储设计的容错能力是系统的生命线。
2. **没有银弹的数据库**：关系型、NoSQL、NewSQL、时序、图各有适用域，选错数据库是架构最大的失误。
3. **缓存是性能杠杆，也是一致性的敌人**：缓存命中率提升 1% 可能带来 10% 的延迟下降，但缓存与数据库的不一致是线上事故的主要来源。
4. **分片是最后的手段，也是必然的归宿**：单机存储总有上限，分片策略决定了系统的可扩展性天花板。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-storage-fundamentals.md](01-storage-fundamentals.md) | 存储基础：数据库分类、CAP/BASE、存储选型、磁盘 vs 内存 |
| [02-database-design.md](02-database-design.md) | 数据库设计：范式与反范式、索引策略、ER 建模、分区表 |
| [03-cache-strategy.md](03-cache-strategy.md) | 缓存策略：Redis 深度、缓存模式、缓存问题、多级缓存架构 |
| [04-sharding-replication.md](04-sharding-replication.md) | 分片与复制：分库分表策略、主从复制、读写分离、分布式 ID |
| [05-transaction-consistency.md](05-transaction-consistency.md) | 事务与一致性：ACID、隔离级别、分布式事务、Saga、TCC |
| [06-performance-optimization.md](06-performance-optimization.md) | 性能优化：查询优化、连接池、批量操作、慢查询治理 |
| [07-migration-backup.md](07-migration-backup.md) | 迁移与备份：Schema 迁移、数据迁移、备份策略、灾难恢复 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/connection-pool.md](mini-impl/connection-pool.md) | 手写数据库连接池 |
| [mini-impl/cache-framework.md](mini-impl/cache-framework.md) | 手写缓存框架（TTL / LRU / LFU / 并发安全） |

## 存储选型决策树

```
数据模型？
  ├─ 结构化关系数据 → MySQL / PostgreSQL
  ├─ 文档型 → MongoDB
  ├─ Key-Value → Redis / etcd / DynamoDB
  ├─ 宽列 → Cassandra / HBase
  ├─ 时序 → InfluxDB / TimescaleDB / TDengine
  ├─ 图 → Neo4j / Dgraph
  ├─ 搜索 → Elasticsearch
  └─ 日志 → ClickHouse / Doris

一致性要求？
  ├─ 强一致性（CP）→ PostgreSQL / etcd / TiDB
  ├─ 最终一致性（AP）→ Cassandra / DynamoDB
  └─ 可调一致性 → CockroachDB / ScyllaDB

数据量？
  ├─ < 100GB → 单机数据库 + 缓存
  ├─ 100GB - 10TB → 主从 + 分区表
  ├─ 10TB - 1PB → 分库分表 / NewSQL
  └─ > 1PB → 数据仓库 / 分布式存储

读写比例？
  ├─ 读多写少 → 读写分离 + 缓存 + 搜索引擎
  ├─ 读写均衡 → 主从 + 连接池优化
  └─ 写多读少 → LSM-Tree（Cassandra/RocksDB）

QPS 要求？
  ├─ < 1K → 单机足够
  ├─ 1K - 10K → 主从 + 连接池
  ├─ 10K - 100K → 分片 + 缓存
  └─ > 100K → 分布式数据库 + 多级缓存
```
