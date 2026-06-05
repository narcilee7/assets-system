# B+Tree Index Deep Dive

## 目标

理解 B+Tree 作为数据库索引的核心原理：结构、查找、插入、删除、聚簇 vs 非聚簇、覆盖索引。

## 场景

- 为什么加了索引反而可能变慢？
- 联合索引的最左前缀原则怎么用？
- 索引下推（Index Condition Pushdown）是什么？
- 前缀索引和全字段索引的选择？

## B+Tree 结构

```
        [15 | 30 | 45 | 60]
       /     |     \     \
  [1-14]  [15-29] [30-44] [45-59] [60-75] ...
   |        |       |       |       |
 叶子节点  叶子节点  叶子节点  叶子节点  叶子节点

B+Tree 特征：
- 非叶子节点只存索引（key），不存数据
- 叶子节点存所有数据（或指向数据的指针）
- 叶子节点之间用双向链表连接（范围查询高效）
- 每个节点有固定大小（通常 16KB）
```

### 与 B-Tree 的区别

```
B-Tree：所有节点都存数据，非叶子节点也存数据
B+Tree：非叶子节点只存索引，叶子节点存全部数据

B+Tree 优势：
1. 非叶子节点不存数据，同样的页大小能存更多索引
2. 查询路径更短（树深度更小）
3. 叶子节点链表，范围查询高效
```

### 树深度计算

```
InnoDB 页大小：16KB
主键 BIGINT：8 字节
索引 + 指针：14 字节/索引

每节点索引数：16KB / 14 ≈ 1170

深度 1：1170 个索引 -> 1170 叶子节点
深度 2：1170 × 1170 ≈ 136 万条记录
深度 3：1170³ ≈ 16 亿条记录

通常深度 2-3 够用
```

## 查找过程

```sql
SELECT * FROM users WHERE id = 15;

查找：
  1. 从根节点找：15 < 30，走左侧
  2. 从第一层节点找：15 在 [15-29] 区间
  3. 定位到叶子节点 [15-29]
  4. 在叶子节点中顺序查找，找到 id=15
```

### 全值匹配 vs 范围匹配

```sql
-- 全值匹配：精确到叶子节点扫描
SELECT * FROM users WHERE name = 'Alice';

-- 范围匹配：定位起点，链表向后扫描
SELECT * FROM users WHERE id BETWEEN 10 AND 30;
-- 定位到 10，然后沿着链表扫描到 30
```

## 聚簇索引 vs 非聚簇索引

### 聚簇索引（Clustered Index）

```
叶子节点存完整行数据

InnoDB 表：
  - 主键是聚簇索引
  - 如果没有主键，用唯一键
  - 如果没有唯一键，生成隐藏 ROW_ID

优点：主键查询直接返回完整数据（回表少）
缺点：插入顺序影响性能（随机写）
```

### 非聚簇索引（Secondary Index）

```
叶子节点存：索引值 + 主键

非聚簇索引查找：
  1. 先查索引树，找到主键
  2. 再用主键查聚簇索引（回表）
  3. 最终拿到完整行

SELECT name FROM users WHERE name = 'Alice';
  - 命中 name 索引，叶子节点有 name 和 id
  - 不需要回表（覆盖索引）
```

### 回表问题

```sql
-- 需要回表（两次索引查找）
SELECT * FROM users WHERE name = 'Alice';
  - 查 name 索引，找到主键 id=5
  - 查主键索引，找到完整行
  - 2 次索引查找

-- 不需要回表（覆盖索引）
SELECT name FROM users WHERE name = 'Alice';
  - 查 name 索引，叶子节点直接有 name
  - 1 次索引查找
```

## 联合索引

### 最左前缀原则

```sql
INDEX idx_name_age (name, age)

-- 生效：name
SELECT * FROM users WHERE name = 'Alice';

-- 生效：name + age（最左连续）
SELECT * FROM users WHERE name = 'Alice' AND age = 25;

-- 生效：name OR age（两个独立查找）
-- （MySQL 会优化，可能用索引合并）

-- 不生效：age（跳过最左）
SELECT * FROM users WHERE age = 25;

-- 范围查询后中断
SELECT * FROM users WHERE name = 'Alice' AND age > 25;
  - name 生效，age 用范围查询后停止
```

### 索引下推（Index Condition Pushdown, ICP）

```sql
SELECT * FROM users WHERE name = 'Alice' AND age = 25;

无 ICP：
  1. 通过 name 索引找到所有 name='Alice' 的主键
  2. 回表，得到完整行
  3. 在服务层过滤 age=25

有 ICP（MySQL 5.6+）：
  1. 通过 name 索引找到所有 name='Alice' 的主键
  2. 在索引层面过滤 age=25（不需要回表）
  3. 只对满足 age=25 的主键回表

减少回表次数，提升性能
```

### 前缀索引

```sql
-- 全字段索引
ALTER TABLE users ADD INDEX idx_email (email);

-- 前缀索引（取前 10 个字符）
ALTER TABLE users ADD INDEX idx_email (email(10));

-- 选择前缀长度：区分度
SELECT COUNT(DISTINCT LEFT(email, 5)) / COUNT(*) FROM users;
SELECT COUNT(DISTINCT LEFT(email, 10)) / COUNT(*) FROM users;
-- 区分度 > 0.9 较好

前缀索引限制：
  - 不能用于 ORDER BY
  - 不能用于 GROUP BY
  - 不能做范围查询
```

## 索引失效

### 常见失效场景

```sql
-- 1. 函数操作
WHERE YEAR(created_at) = 2024
  -> 不使用 created_at 索引

  改为：WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'

-- 2. 类型转换
WHERE phone = 123456789
  -> phone 是 VARCHAR，隐式类型转换不用索引

  改为：WHERE phone = '123456789'

-- 3. 左模糊匹配
WHERE name LIKE '%Alice%'  -- 不使用索引
WHERE name LIKE 'Alice%'   -- 使用索引（前缀匹配）

-- 4. OR 连接
WHERE name = 'Alice' OR age = 25
  -> 只有 name 有索引，age 不用

  改为：WHERE name = 'Alice' UNION WHERE age = 25

-- 5. 独立使用范围
WHERE age > 20 AND name = 'Alice'
  -> age 范围查询后，name 索引可能不生效

  改为：WHERE name = 'Alice' AND age > 20（顺序重要）
```

### 索引覆盖度分析

```sql
EXPLAIN FORMAT=JSON
SELECT name, age FROM users WHERE name = 'Alice' AND age = 25;
-- 看到 "using index" 说明覆盖索引
-- 看到 "using index condition" 说明有 ICP
```

## 核心追问

1. **为什么加了索引反而可能变慢？** 索引本身有维护成本（插入/删除/更新要同步更新索引）；低选择性字段（性别）索引数据量大但查询不一定快；回表开销大
2. **联合索引的最左前缀原则怎么工作？** 索引是按 (a, b, c) 顺序构建的 B+Tree，如果查询没有 a，就无法确定在树中的位置，只能全扫描
3. **覆盖索引为什么快？** 不需要回表，直接在非聚簇索引叶子节点拿到需要的所有字段，减少一次索引查找
4. **聚簇索引的插入为什么可能慢？** 如果按自增主键插入，数据按顺序写叶子节点；如果按 UUID 或随机主键插入，会产生随机 I/O（页分裂）
5. **索引下推（ICP）减少什么？** 减少回表次数：在索引层面过滤条件，而不是把所有匹配的主键都回表后再过滤

## 状态

| 资产 | 状态 |
|---|---|
| B+Tree index deep dive | done |
| MVCC and isolation levels | todo |
| WAL crash recovery notes | todo |
| slow query diagnosis playbook | todo |
| replication lag and consistency | todo |