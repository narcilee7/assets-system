# Database

数据库是后端系统的状态中心。面试不仅要能写 SQL，还要理解模型设计、索引选择、事务隔离、性能优化和高可用架构。

## 核心维度

| 维度 | 关注点 |
| --- | --- |
| Schema Design | 范式、反范式、主键、外键、枚举、JSON 字段 |
| SQL Query | SELECT / JOIN / 子查询 / CTE / 窗口函数 / 递归 |
| Indexing | B+Tree、覆盖索引、最左前缀、索引下推、避免回表 |
| Transaction | ACID、隔离级别、锁、MVCC、幻读、死锁 |
| Performance | 执行计划、慢查询、分页优化、大表治理 |
| High Availability | 主从复制、读写分离、分库分表、分布式事务 |
| NoSQL Trade-off | KV、文档、列族、图数据库的适用场景 |

## 资产

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| SQL 场景题 | done | `sql-scenarios/README.md`：覆盖 10 个业务场景的 22 道 SQL 题，含反模式、索引工作坊、事务锁实验、执行计划、分库分表改写、速查表 |
| 统一 Schema | done | `sql-scenarios/schema.sql`：所有场景表的完整 DDL |
| 统一查询 | done | `sql-scenarios/queries.sql`：所有场景核心查询汇总 |
| 索引与执行计划实战 | todo | 慢查询分析、EXPLAIN、覆盖索引设计 |
| 事务与锁实验 | todo | 隔离级别演示、死锁检测与避免 |
| 分库分表设计 | todo | 拆分策略、全局 ID、分布式查询 |

## 追问

- 这个查询为什么慢？瓶颈在 CPU、IO 还是网络？
- 索引加在哪里？加完索引后写性能会下降多少？
- 高并发下这条 SQL 会不会产生死锁？
- 数据量增长到 10 亿行， schema 和查询如何演进？
