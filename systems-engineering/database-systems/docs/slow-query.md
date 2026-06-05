# Slow Query Diagnosis Playbook

## 目标

掌握慢查询的诊断和优化方法：分析执行计划、定位索引问题、解决锁等待、I/O 瓶颈。

## 场景

- 查询突然变慢，如何快速定位？
- EXPLAIN 输出怎么看？
- 索引用了但还是慢，问题在哪？
- 锁等待导致超时怎么排查？

## 诊断路径

### 0. 快速发现（5 分钟）

```sql
-- 1. 查看慢查询日志
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'slow_query_log_file';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'log_queries_not_using_indexes';

-- 2. 查看当前查询
SHOW PROCESSLIST;
-- 或
SELECT * FROM information_schema.processlist WHERE command != 'Sleep' ORDER BY time DESC;

-- 3. 查看锁等待
SELECT * FROM information_schema.innodb_lock_waits;
SELECT * FROM information_schema.innodb_trx;

-- 4. 查看资源使用
SHOW STATUS LIKE 'Threads%';
SHOW STATUS LIKE 'Innodb_rows%';
```

### 1. EXPLAIN 分析

```sql
EXPLAIN SELECT * FROM users WHERE name = 'Alice' AND age > 20;

-- 关键字段：
-- type: ALL（全表）< index < range < ref < eq_ref < const
--   - ALL：最差，需要全表扫描
--   - range：范围扫描，可接受
--   - ref：索引等值查询，较好
--   - const：主键/唯一索引，PK lookup，最快

-- key: 实际使用的索引
-- rows: 扫描行数估算，越小越好

-- extra: 额外信息
--   - Using where：服务端过滤
--   - Using index：覆盖索引
--   - Using index condition：索引下推
--   - Using filesort：需要排序
--   - Using temporary：需要临时表
```

### 2. 索引问题

```sql
-- 索引被忽略的情况

-- 1. 函数
WHERE YEAR(created_at) = 2024
  -> 即使 created_at 有索引也不用

-- 2. 类型转换
WHERE phone = 123456789  -- phone 是 VARCHAR
  -> 隐式类型转换，索引失效

-- 3. 左模糊
WHERE name LIKE '%Alice%'
  -> 不能用索引

-- 4. OR
WHERE name = 'Alice' OR age = 25
  -> 只有 name 的索引生效，age 不生效

-- 5. 不满足最左前缀
INDEX (a, b, c)
WHERE b = 1  -- 不生效
WHERE a = 1 AND c = 1  -- a 生效，c 不生效
```

### 3. 锁等待问题

```sql
-- 查看当前锁
SELECT 
    r.trx_id AS waiting_trx_id,
    r.trx_mysql_thread_id AS waiting_thread,
    r.trx_query AS waiting_query,
    b.trx_id AS blocking_trx_id,
    b.trx_mysql_thread_id AS blocking_thread,
    b.trx_query AS blocking_query
FROM information_schema.innodb_lock_waits w
JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id;

-- 查看锁详情
SHOW ENGINE INNODB LOCKS;

-- 查看事务详情
SHOW ENGINE INNODB STATUS;

-- 长时间未提交的事务
SELECT * FROM information_schema.innodb_trx 
WHERE trx_started < NOW() - INTERVAL 60 SECOND;
```

### 4. I/O 问题

```sql
-- 临时表和排序溢出
SHOW STATUS LIKE 'Created_tmp%';
SHOW STATUS LIKE 'Sort%';

-- 优化方法
-- 1. 减少 SELECT *
SELECT id, name FROM users WHERE age > 20;  -- 覆盖索引

-- 2. 增加 sort_buffer_size（会话级）
SET sort_buffer_size = 1024 * 1024 * 2;

-- 3. 增加 join_buffer_size
SET join_buffer_size = 1024 * 1024 * 2;
```

### 5. 分页优化

```sql
-- 低效：
SELECT * FROM orders ORDER BY id LIMIT 1000000, 10;
-- 需要扫描 1000010 行，只返回 10 行

-- 高效：
SELECT * FROM orders WHERE id > 1000000 ORDER BY id LIMIT 10;
-- 索引定位到 1000000，只扫描 10 行

-- 或者用延迟关联
SELECT * FROM orders o
JOIN (SELECT id FROM orders ORDER BY id LIMIT 1000000, 10) t 
ON o.id = t.id;
```

## 常见慢查询模式

### 1. 深分页

```sql
-- 问题
SELECT * FROM orders WHERE status = 'completed' LIMIT 1000000, 10;
-- 扫描 1000010 行

-- 解决：延迟关联
SELECT o.* FROM orders o
INNER JOIN (
    SELECT id FROM orders WHERE status = 'completed' ORDER BY id LIMIT 1000000, 10
) t ON o.id = t.id;

-- 或使用游标
SELECT * FROM orders WHERE id > 1000000 AND status = 'completed' ORDER BY id LIMIT 10;
```

### 2. 大量小查询

```sql
-- 问题：循环查单个订单
for order_id in [1, 2, 3, ...]:
    SELECT * FROM orders WHERE id = order_id;

-- 解决：批量查询
SELECT * FROM orders WHERE id IN (1, 2, 3, ...);
```

### 3. 不必要的排序

```sql
-- 问题：不需要排序但用了 ORDER BY
SELECT * FROM users WHERE status = 1;
-- 没有索引支持 status+created_at，默认按主键排序

-- 解决：
-- 1. 加覆盖索引
ALTER TABLE users ADD INDEX idx_status_created (status, created_at);

-- 2. 或者使用 STRAIGHT_JOIN 强制顺序
SELECT STRAIGHT_JOIN * FROM orders o JOIN users u ON o.user_id = u.id;
```

### 4. 错误的 JOIN

```sql
-- 问题：没有索引的 JOIN
SELECT * FROM orders o JOIN users u ON o.user_id = u.id;
-- 如果 o.user_id 和 u.id 没有索引，会很慢

-- 解决：
-- 1. 加索引
ALTER TABLE orders ADD INDEX idx_user_id (user_id);

-- 2. 分解查询
SELECT * FROM orders WHERE user_id IN (SELECT id FROM users WHERE status = 1);
```

## 优化检查清单

```sql
-- 1. 索引检查
SHOW CREATE TABLE users;  -- 看有哪些索引
EXPLAIN SELECT ...;       -- 看是否用了索引

-- 2. 统计信息更新
ANALYZE TABLE users;  -- 重新统计索引基数

-- 3. 连接数检查
SHOW STATUS LIKE 'Max_used_connections';
SHOW VARIABLES LIKE 'max_connections';

-- 4. 缓存检查
SHOW STATUS LIKE 'Qcache%';  -- MySQL Query Cache（5.7 移除）
SHOW STATUS LIKE 'Innodb_buffer_pool%';  -- InnoDB Buffer Pool

-- 5. 配置检查
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
SHOW VARIABLES LIKE 'innodb_log_file_size';
```

## 核心追问

1. **EXPLAIN 的 type 字段怎么看？** ALL 最差（全表），const 最好（PK/UK 查找）；range 可接受；ref 良好
2. **Using filesort 怎么优化？** 尽量在索引中排好序（覆盖索引），减少排序数据量；适当调大 sort_buffer_size
3. **锁等待超时怎么排查？** 查 `information_schema.innodb_lock_waits`，找到 blocking_trx 和 waiting_trx，看谁长时间未提交
4. **深分页怎么优化？** 使用延迟关联或游标（基于主键范围）；避免 OFFSET 只用 WHERE id > last_id
5. **为什么加了索引还是慢？** 统计信息过期（ANALYZE TABLE）；索引选择错误（force index）；回表成本太高（改为覆盖索引）

## 状态

| 资产 | 状态 |
|---|---|
| B+Tree index deep dive | done |
| MVCC and isolation levels | done |
| WAL crash recovery notes | done |
| slow query diagnosis playbook | done |
| replication lag and consistency | todo |