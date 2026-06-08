# 存储基础

## 1. 数据库分类全景

```
数据库分类
├── 关系型（SQL）
│   ├── 单机：MySQL, PostgreSQL, SQLite
│   ├── 分布式：TiDB, CockroachDB, YugabyteDB
│   └── 云原生：Aurora, Cloud SQL, AlloyDB
├── NoSQL
│   ├── Key-Value：Redis, etcd, DynamoDB, Riak
│   ├── 文档型：MongoDB, Couchbase, Firestore
│   ├── 宽列：Cassandra, HBase, ScyllaDB
│   └── 图：Neo4j, Dgraph, ArangoDB
├── NewSQL
│   ├── TiDB（Raft + Spanner-like）
│   ├── CockroachDB（Serializable Default）
│   └── YugabyteDB（Redis-compatible YEDIS）
├── 时序数据库
│   ├── InfluxDB, TimescaleDB, TDengine, Prometheus
├── 搜索引擎
│   ├── Elasticsearch, OpenSearch, Solr, Meilisearch
└── OLAP / 数据仓库
    ├── ClickHouse, Doris, StarRocks, Snowflake, BigQuery
```

| 类型 | 代表 | 适用场景 | 不适用 |
|------|------|----------|--------|
| 关系型 | MySQL, PostgreSQL | 事务、复杂查询、JOIN | 超大规模写入、非结构化数据 |
| Key-Value | Redis, etcd | 缓存、配置、会话 | 复杂查询、关系模型 |
| 文档型 | MongoDB | 灵活 schema、嵌套文档 | 多文档事务、复杂 JOIN |
| 宽列 | Cassandra | 高写入、时间序列、大数据 | 复杂查询、强一致性事务 |
| 图 | Neo4j | 关系网络、推荐、路径查找 | 简单 KV、非图结构 |
| 时序 | InfluxDB | 监控、IoT、指标存储 | 通用 OLTP |
| 搜索 | Elasticsearch | 全文搜索、日志分析 | 强一致性事务 |
| OLAP | ClickHouse | 分析查询、报表 | 高并发 OLTP |

## 2. CAP 与 BASE

```
CAP 定理：一致性(C)、可用性(A)、分区容错性(P) 三者不可兼得

网络分区发生时：
  ├─ CP 系统：拒绝写入，保证一致性（etcd, ZooKeeper, HBase）
  ├─ AP 系统：继续服务，保证可用性，最终一致（Cassandra, DynamoDB）
  └─ CA 系统：无网络分区时同时保证 C 和 A（单节点数据库）

PACELC 扩展：
  如果有分区(P)，在可用性(A)和一致性(C)之间选择；
  否则(E)，在延迟(L)和一致性(C)之间选择。
```

| 系统 | CAP 倾向 | 一致性模型 |
|------|----------|------------|
| MySQL (单机) | CA | 强一致 |
| MySQL (主从异步) | AP | 最终一致 |
| PostgreSQL | CA | 强一致 |
| Redis (单机) | CA | 强一致 |
| Redis (Sentinel) | AP | 最终一致 |
| Redis (Cluster) | AP | 最终一致 |
| etcd | CP | 线性一致 |
| ZooKeeper | CP | 顺序一致 |
| Cassandra | AP | 可调一致 |
| MongoDB | CP (默认) | 强一致 |
| TiDB | CP | 线性一致 |

```
BASE 理论（NoSQL 核心思想）
├── Basically Available（基本可用）
│   └── 允许部分故障时系统仍可响应
├── Soft State（软状态）
│   └── 数据可以存在中间状态
└── Eventually Consistent（最终一致）
    └── 不保证实时一致，但保证最终一致

BASE vs ACID：
  ACID：强一致性，适合金融交易
  BASE：高可用性，适合社交网络、电商
```

## 3. 存储介质对比

| 层级 | 介质 | 延迟 | 吞吐量 | 容量 | 成本 | 持久化 |
|------|------|------|--------|------|------|--------|
| L1 | CPU 寄存器 | < 1ns | - | 64B | 极高 | 否 |
| L2 | CPU Cache | ~1ns | - | 64KB | 极高 | 否 |
| L3 | CPU Cache | ~10ns | - | 16MB | 极高 | 否 |
| L4 | 内存 (DRAM) | ~100ns | GB/s | GB | 高 | 否 |
| L5 | NVMe SSD | ~10μs | GB/s | TB | 中 | 是 |
| L6 | SATA SSD | ~100μs | 500MB/s | TB | 中低 | 是 |
| L7 | 机械硬盘 | ~10ms | 200MB/s | TB-PB | 低 | 是 |
| L8 | 网络存储 | ~1ms-100ms | MB/s-GB/s | PB | 低 | 是 |
| L9 | 磁带/冷存 | 秒级 | MB/s | PB-EB | 极低 | 是 |

```
B-Tree vs LSM-Tree

B-Tree（MySQL/InnoDB, PostgreSQL）
  ├── 特点：读优化，随机写需要多次磁盘 I/O
  ├── 优点：读取稳定，范围查询高效，事务支持好
  └── 缺点：写放大高，随机写性能差

LSM-Tree（RocksDB, Cassandra, HBase）
  ├── 特点：写优化，顺序写内存后合并
  ├── 优点：写性能极高，写放大低
  └── 缺点：读可能需多层合并，空间放大， compaction 开销

适用场景：
  B-Tree：读多写少，事务型 OLTP
  LSM-Tree：写多读少，日志型，时序数据
```

## 4. 存储引擎对比

| 引擎 | 结构 | 事务 | 锁粒度 | 适用场景 |
|------|------|------|--------|----------|
| InnoDB (MySQL) | B+Tree | ACID | 行级锁 | 通用 OLTP |
| MyISAM (MySQL) | B+Tree | 不支持 | 表级锁 | 只读分析（已废弃）|
| RocksDB (MyRocks) | LSM-Tree | ACID | 行级锁 | 高写入 OLTP |
| WiredTiger (MongoDB) | B-Tree/LSM | 多文档 | 文档级 | 文档存储 |
| Memory (Redis) | Hash + SkipList | Lua 原子 | 无 | 内存缓存 |
| TiKV (TiDB) | LSM-Tree (RocksDB) | 分布式 | 行级 | 分布式 OLTP |
