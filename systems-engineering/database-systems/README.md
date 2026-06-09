# 数据库系统工程化

数据库系统工程化训练 —— 达到"能为业务选择合适的存储方案、能设计高可用架构、能优化查询性能、能理解 OLAP/向量/大数据生态"的水平。

## 训练哲学

1. **没有银弹**：关系型、文档型、键值型、列式、向量数据库各有适用场景，选型比调优更重要。
2. **理解原理才能调优**：索引、事务、存储引擎的原理是所有优化的基础。
3. **可观测性优先**：慢查询、锁等待、复制延迟的监控比事后救火更有效。
4. **数据是企业的核心资产**：备份、恢复、一致性是底线要求。

## 体系索引

### 基础原理（现有深度文档）

| 文档 | 内容 |
|------|------|
| [docs/btree-index.md](docs/btree-index.md) | B+Tree 索引深入：结构、查找、插入、删除、聚簇/非聚簇、覆盖索引、最左前缀 |
| [docs/mvcc.md](docs/mvcc.md) | MVCC 与隔离级别：四种隔离级别、Read View、幻读与不可重复读 |
| [docs/wal.md](docs/wal.md) | WAL 崩溃恢复：redo/undo、CheckPoint、ARIES 算法 |
| [docs/slow-query.md](docs/slow-query.md) | 慢查询诊断：EXPLAIN 分析、索引优化、执行计划 |
| [docs/replication.md](docs/replication.md) | 复制延迟与一致性：主从复制、半同步、GTID、读写分离 |

### 数据库系统专题

| 文档 | 内容 |
|------|------|
| [01-relational-fundamentals.md](01-relational-fundamentals.md) | 关系型基础：ACID、范式、索引策略、查询优化、连接算法 |
| [02-mysql-engineering.md](02-mysql-engineering.md) | MySQL 工程化：InnoDB、复制架构、分库分表、连接池、备份 |
| [03-postgresql-advanced.md](03-postgresql-advanced.md) | PostgreSQL 高级：JSONB、分区、扩展、逻辑复制、VACUUM |
| [04-redis-caching.md](04-redis-caching.md) | Redis：数据结构、持久化、集群、缓存模式、缓存问题 |
| [05-mongodb-nosql.md](05-mongodb-nosql.md) | MongoDB：文档模型、聚合、索引、副本集、分片 |
| [06-olap-clickhouse.md](06-olap-clickhouse.md) | ClickHouse：列式存储、MergeTree、物化视图、OLAP 场景 |
| [07-vector-databases.md](07-vector-databases.md) | 向量数据库：HNSW/IVF、LanceDB、Milvus、PgVector、混合检索 |
| [08-data-lake-bigdata.md](08-data-lake-bigdata.md) | 数据湖与大数据：Parquet/Iceberg、Spark/Flink、HDFS、Lambda/Kappa |

### 手写实现

| 文档 | 内容 |
|------|------|
| [mini-impl/btree-index.md](mini-impl/btree-index.md) | 手写 B+Tree 索引（插入、查找、范围查询） |
| [mini-impl/lru-cache.md](mini-impl/lru-cache.md) | 手写 LRU Cache（Redis 核心淘汰策略） |

## 存储选型决策树

```
数据结构？
  ├─ 结构化表数据 → 关系型（MySQL / PostgreSQL）
  ├─ 文档/半结构化 → MongoDB / PostgreSQL JSONB
  ├─ 键值对 → Redis / DynamoDB
  ├─ 宽列/时序 → Cassandra / ClickHouse / InfluxDB
  ├─ 图数据 → Neo4j / Dgraph
  └─ 向量 → LanceDB / Milvus / PgVector

读写特征？
  ├─ OLTP（高并发短事务）→ MySQL / PostgreSQL
  ├─ OLAP（大批量分析）→ ClickHouse / Snowflake / BigQuery
  ├─ 缓存 → Redis / Memcached
  ├─ 搜索 → Elasticsearch / Meilisearch
  └─ 流处理 → Kafka + Flink

一致性要求？
  ├─ 强一致性 + 高可用 → PostgreSQL / MySQL（主从同步）
  ├─ 最终一致 + 高吞吐 → Cassandra / DynamoDB
  └─ 无一致性要求 → Redis / 本地缓存

数据规模？
  ├─ < 1TB → 单机关系型足够
  ├─ 1TB - 100TB → 分库分表 / PostgreSQL 分区 / ClickHouse
  ├─ 100TB - PB → 数据湖（Iceberg + Spark）
  └─ > PB → 专用大数据平台
```
