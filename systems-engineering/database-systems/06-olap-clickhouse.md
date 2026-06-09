# ClickHouse 与 OLAP

## 1. 列式存储 vs 行式存储

```
行式存储（MySQL / PostgreSQL）
┌────────────────────────────────────────┐
│ id │ name  │ age │ city     │ amount   │
├────────────────────────────────────────┤
│ 1  │ Alice │ 25  │ Beijing  │ 100.0    │ ← 一行数据连续存储
│ 2  │ Bob   │ 30  │ Shanghai │ 200.0    │
└────────────────────────────────────────┘
├── 优点：单行查询快（SELECT * WHERE id = 1）
├── 优点：事务更新方便
└── 缺点：聚合查询慢（需要读取整行）

列式存储（ClickHouse / Parquet）
┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌────────┐
│ [1, 2]   │  │[Alice,Bob│  │[25, 30]│  │[BJ, SH]  │  │[100,200│
└──────────┘  └──────────┘  └────────┘  └──────────┘  └────────┘
  id 列        name 列       age 列      city 列      amount 列
├── 优点：聚合查询极快（只读需要的列）
├── 优点：列内数据类型一致，压缩率高
├── 优点：向量化执行（SIMD）
└── 缺点：单行查询慢、更新删除困难

适用场景对比
行式：OLTP（交易、订单、用户管理）
列式：OLAP（分析、报表、日志、时序数据）
```

## 2. MergeTree 引擎家族

```
MergeTree（ClickHouse 核心引擎）
├── 数据按主键排序存储
├── 后台合并（Merge）小 part 为大 part
├── 支持分区（Partition）
└── 不可变数据（删除用 mutation）

引擎类型
├── MergeTree：基础引擎
├── ReplacingMergeTree：去重（保留最新版本）
├── SummingMergeTree：聚合数值列
├── AggregatingMergeTree：预聚合
├── CollapsingMergeTree：用 Sign 标记增删
├── VersionedCollapsingMergeTree：带版本号的折叠
└── GraphiteMergeTree：Graphite 数据专用
```

```sql
-- 创建表
CREATE TABLE events (
    event_date Date,
    event_time DateTime,
    user_id UInt64,
    event_type String,
    platform String,
    revenue Float64
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_type, event_time, user_id)
SETTINGS index_granularity = 8192;

-- ReplacingMergeTree（去重）
CREATE TABLE user_snapshots (
    user_id UInt64,
    update_time DateTime,
    name String,
    age UInt8
)
ENGINE = ReplacingMergeTree(update_time)
ORDER BY user_id;
-- 查询时加 FINAL：SELECT * FROM user_snapshots FINAL

-- SummingMergeTree（预聚合）
CREATE TABLE sales_daily (
    date Date,
    product_id UInt32,
    total_amount Float64,
    quantity UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (date, product_id);
```

## 3. 查询优化

```sql
-- 物化视图（预计算）
CREATE MATERIALIZED VIEW sales_by_day
ENGINE = SummingMergeTree()
ORDER BY (date, product_id)
AS SELECT
    toDate(event_time) as date,
    product_id,
    sum(amount) as total_amount,
    count() as order_count
FROM orders
GROUP BY date, product_id;

-- 投影（Projection，加速特定查询模式）
ALTER TABLE events ADD PROJECTION event_by_platform
(
    SELECT * ORDER BY platform, event_time
);

-- 采样查询（大数据集快速估算）
SELECT avg(revenue) FROM events SAMPLE 0.1;
-- 只读 10% 数据，结果近似

-- 限制扫描分区
SELECT * FROM events
WHERE event_date >= '2024-06-01' AND event_date < '2024-07-01';
-- 只扫描 202406 分区
```

## 4. ClickHouse 架构

```
ClickHouse 集群架构

                ┌─────────────┐
                │   Client    │
                └──────┬──────┘
                       │
                ┌──────┴──────┐
                │  Distributed │
                │    Table     │
                └──────┬──────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │ Shard 1 │  │ Shard 2 │  │ Shard 3 │
    │ (Replica│  │ (Replica│  │ (Replica│
    │  A, B)  │  │  A, B)  │  │  A, B)  │
    └─────────┘  └─────────┘  └─────────┘

分片（Sharding）：数据水平拆分
副本（Replication）：高可用（ZooKeeper/Keeper 协调）
分布式表：自动路由到对应分片
```

```xml
<!-- 集群配置 -->
<clickhouse>
  <remote_servers>
    <my_cluster>
      <shard>
        <replica><host>ck1</host><port>9000</port></replica>
        <replica><host>ck2</host><port>9000</port></replica>
      </shard>
      <shard>
        <replica><host>ck3</host><port>9000</port></replica>
        <replica><host>ck4</host><port>9000</port></replica>
      </shard>
    </my_cluster>
  </remote_servers>
</clickhouse>
```
