# PostgreSQL 高级特性

## 1. MVCC 与 VACUUM

```
PostgreSQL MVCC 实现

版本链
├── 每行数据有 xmin（创建事务）、xmax（删除事务）
├── UPDATE = DELETE + INSERT（产生新版本）
├── 旧版本对快照不可见，但物理存在
└── 快照判断：TransactionIdIsCurrentTransactionId / TransactionIdDidCommit

VACUUM
├── 清理死元组（dead tuples）
├── 更新可见性地图（Visibility Map）
├── 防止事务 ID 回卷（wraparound）
└── VACUUM FULL：重建表，释放空间（锁表）

VACUUM 调优
├── autovacuum：自动清理
├── autovacuum_vacuum_threshold：触发阈值
├── autovacuum_vacuum_scale_factor：比例因子
├── 大表问题：scale_factor = 0.1，1000万行表需100万变更才触发
└── 解决：按表设置，或降低 scale_factor
```

```sql
-- 查看死元组
SELECT schemaname, relname, n_dead_tup, n_live_tup,
       round(n_dead_tup::numeric/nullif(n_live_tup,0)*100, 2) as dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

-- 手动 VACUUM
VACUUM ANALYZE users;

-- 大表调优
ALTER TABLE big_table SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005
);
```

## 2. JSONB 与文档能力

```sql
-- JSONB 创建与查询
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 插入
INSERT INTO events (data) VALUES
  ('{"user_id": 1, "action": "login", "ip": "1.2.3.4"}'),
  ('{"user_id": 2, "action": "purchase", "items": [{"id": 1, "price": 99.99}]}');

-- 查询
SELECT * FROM events WHERE data @> '{"action": "login"}';
SELECT data->>'ip' FROM events WHERE data->>'action' = 'login';

-- GIN 索引加速 JSONB 查询
CREATE INDEX idx_events_data ON events USING GIN (data);
CREATE INDEX idx_events_action ON events ((data->>'action'));

-- JSONB 聚合
SELECT data->>'action' as action, COUNT(*) as cnt
FROM events
GROUP BY data->>'action';
```

## 3. 分区表

```sql
-- 范围分区（时间）
CREATE TABLE measurements (
  id SERIAL,
  city_id INT,
  temperature FLOAT,
  created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- 创建分区
CREATE TABLE measurements_y2024m01 PARTITION OF measurements
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE measurements_y2024m02 PARTITION OF measurements
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- 自动分区（pg_partman）
SELECT partman.create_parent('public.measurements', 'created_at', 'native', 'monthly');

-- 查询优化：分区裁剪
EXPLAIN SELECT * FROM measurements WHERE created_at >= '2024-01-15';
-- 只扫描 measurements_y2024m01 分区
```

## 4. 高级索引

```sql
-- GiST（通用搜索树）- 地理数据
CREATE INDEX idx_locations_geo ON locations USING GiST (ll_to_earth(lat, lng));

-- GIN（广义倒排索引）- 数组、全文搜索
CREATE INDEX idx_fts ON articles USING GIN (to_tsvector('english', content));

-- BRIN（块范围索引）- 时序大数据，极小空间
CREATE INDEX idx_measurements_brin ON measurements USING BRIN (created_at);

-- SP-GiST - 前缀树、四叉树
CREATE INDEX idx_ip ON accesses USING SP_GiST (ip inet_ops);
```

## 5. 扩展生态

```
常用扩展
├── PostGIS：地理空间数据库
├── pgvector：向量相似度搜索
├── TimescaleDB：时序数据库扩展
├── Citus：分布式 PostgreSQL
├── pg_stat_statements：SQL 统计
├── uuid-ossp：UUID 生成
└── hstore：键值存储

安装
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

## 6. 逻辑复制

```
逻辑复制 vs 物理复制

物理复制
├── 复制 WAL 字节流
├── 整实例复制
├── 从库只读
└── 版本必须一致

逻辑复制
├── 复制逻辑变更（INSERT/UPDATE/DELETE）
├── 可订阅单个表
├── 可跨版本
├── 可写入从库
├── 支持不同数据结构
└── 基于发布-订阅模型
```

```sql
-- 发布端
CREATE PUBLICATION my_pub FOR TABLE users, orders;

-- 订阅端
CREATE SUBSCRIPTION my_sub
  CONNECTION 'host=publisher dbname=mydb user=replica password=secret'
  PUBLICATION my_pub;
```
