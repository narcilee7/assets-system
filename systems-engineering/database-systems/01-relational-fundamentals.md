# 关系型数据库基础

## 1. ACID

```
ACID 属性

Atomicity（原子性）
├── 事务是最小执行单位，不可再分
├── 全部成功 或 全部回滚
├── 实现：Undo Log（回滚日志）
└── 示例：转账 A→B，扣款和入账必须同时成功或同时失败

Consistency（一致性）
├── 事务执行前后，数据库处于一致状态
├── 数据库定义的约束必须满足
├── 外键约束、CHECK 约束、触发器
└── 注意：CAP 中的一致性 ≠ ACID 中的一致性

Isolation（隔离性）
├── 并发事务之间互不干扰
├── 实现：锁、MVCC
└── 四种隔离级别见下文

Durability（持久性）
├── 已提交的事务，数据永久保存
├── 实现：WAL（Write-Ahead Log）
└── 即使系统崩溃，数据也不丢失
```

## 2. 事务隔离级别

```
四种隔离级别

Read Uncommitted（RU）
├── 事务可读到其他事务未提交的数据
├── 问题：脏读（Dirty Read）
└── 几乎不用

Read Committed（RC）
├── 只能读到已提交的数据
├── 问题：不可重复读（同一事务内两次读结果不同）
├── Oracle / PostgreSQL 默认
└── 适合：读多写少，对一致性要求不高的场景

Repeatable Read（RR）
├── 同一事务内多次读结果一致
├── 问题：幻读（范围查询结果集变化）
├── MySQL InnoDB 默认（通过 MVCC + Next-Key 锁解决幻读）
└── 适合：对一致性要求高的业务

Serializable（串行化）
├── 完全串行执行
├── 无并发问题
└── 性能最差，极少使用
```

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 实现方式 |
|----------|------|-----------|------|----------|
| RU | ✓ | ✓ | ✓ | 无 |
| RC | ✗ | ✓ | ✓ | MVCC（每次读生成 Read View）|
| RR | ✗ | ✗ | ✗* | MVCC（事务开始时生成 Read View）+ Next-Key 锁 |
| Serializable | ✗ | ✗ | ✗ | 锁所有读的行 + 范围锁 |

*InnoDB 在 RR 下通过 Next-Key 锁基本避免幻读，但非锁定读（快照读）仍可能

```sql
-- MySQL 设置隔离级别
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- PostgreSQL 默认 RC
BEGIN ISOLATION LEVEL SERIALIZABLE;
```

## 3. 数据库范式

```
范式（Normal Forms）

1NF（第一范式）
├── 每个字段值不可再分（原子性）
├── 反例：phones = "13800138000,13900139000"
├── 正例：单独 phone 表

2NF（第二范式）
├── 满足 1NF + 非主属性完全依赖于主键
├── 消除部分依赖
├── 反例：订单表 (order_id, product_id, product_name) — product_name 只依赖 product_id

3NF（第三范式）
├── 满足 2NF + 非主属性不传递依赖于主键
├── 消除传递依赖
├── 反例：员工表 (id, dept_id, dept_name) — dept_name 依赖 dept_id

BCNF（巴斯-科德范式）
├── 满足 3NF + 每个决定因素都是候选键
├── 消除主属性对候选键的部分/传递依赖
└── 比 3NF 更严格

反范式设计
├── 适当冗余减少 JOIN，提升查询性能
├── 缓存计算结果（如订单总金额）
├── 历史数据归档表
└── 原则：先满足范式，再根据查询模式反范化
```

## 4. 索引策略

```
索引类型

B+Tree 索引
├── 最常用，支持范围查询、排序
├── 聚簇索引：数据按主键顺序存储（InnoDB）
├── 非聚簇索引：叶子节点存主键（二级索引）
└── 回表：二级索引查到主键后，再查聚簇索引

Hash 索引
├── 等值查询极快
├── 不支持范围查询、排序
├── Memory 引擎、InnoDB 自适应哈希
└── 冲突处理：链地址法

全文索引
├── 倒排索引，支持分词搜索
├── MyISAM / InnoDB 5.6+ / Elasticsearch
└── 中文需额外配置

空间索引
├── R-Tree，地理数据
├── PostGIS、MySQL 5.7+
└── 适合：位置查询、范围查询

索引设计原则
├── 选择性高的列放前面（联合索引）
├── 避免冗余索引（(a,b) 和 (a) 冗余）
├── 覆盖索引：查询字段全在索引中，避免回表
├── 最左前缀：联合索引 (a,b,c)，查询条件必须有 a
├── 索引下推（ICP）：MySQL 5.6+，在引擎层过滤
└── 不要过度索引：写操作变慢、占用空间
```

```sql
-- 联合索引最左前缀
CREATE INDEX idx_name_age ON users(name, age);

-- 可用：name = 'Alice'
-- 可用：name = 'Alice' AND age = 20
-- 可用：name LIKE 'A%'（范围查询后列失效）
-- 不可用：age = 20（缺少 name）

-- 覆盖索引
CREATE INDEX idx_order ON orders(user_id, status, created_at);

SELECT user_id, status, created_at FROM orders WHERE user_id = 1;
-- 索引包含所有查询字段，无需回表
```

## 5. 查询优化

```
查询优化器

Cost-Based Optimizer（CBO）
├── 估算不同执行计划的成本
├── 成本因素：IO、CPU、内存、网络
├── 依赖统计信息（表大小、索引选择性）
└── 大多数现代数据库使用 CBO

Join 算法
├── Nested Loop Join：小表驱动，适合有索引
├── Hash Join：大表无索引，先建哈希表
├── Sort-Merge Join：有序数据，适合大表
└── MySQL 8.0.18+ 支持 Hash Join

执行计划分析
EXPLAIN 关键字段：
├── type：访问类型（system > const > eq_ref > ref > range > index > ALL）
├── key：使用的索引
├── rows：预估扫描行数
├── Extra：附加信息
│   ├── Using index：覆盖索引
│   ├── Using where：WHERE 过滤
│   ├── Using filesort：额外排序（需优化）
│   └── Using temporary：临时表（需优化）
└── 目标：type 至少 range，避免 ALL
```

```sql
-- EXPLAIN 示例
EXPLAIN ANALYZE
SELECT u.name, COUNT(o.id)
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id;

-- 优化：确保 orders.user_id 有索引
-- 优化：考虑覆盖索引 (user_id, id)
-- 优化：如果 users 很大，考虑分区
```
