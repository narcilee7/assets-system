# MVCC and Isolation Levels

## 目标

理解多版本并发控制（MVCC）的实现机制，以及四种隔离级别（RU/RC/RR/SERIALIZABLE）的区别。

## 场景

- 幻读和不可重复读的区别？
- RR 为什么在某些场景下不能保证一致性？
- 读视图（Read View）是如何工作的？
- 为什么 RC 比 RR 快？

## 四种隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|---|---|---|---|
| Read Uncommitted (RU) | 可能 | 可能 | 可能 |
| Read Committed (RC) | 不可能 | 可能 | 可能 |
| Repeatable Read (RR) | 不可能 | 不可能 | 可能（InnoDB 靠 Next-Key 锁避免） |
| Serializable | 不可能 | 不可能 | 不可能 |

### 脏读（Dirty Read）

```
事务 A 写入：UPDATE users SET balance = 0 WHERE id = 1
事务 B 读取：SELECT balance FROM users WHERE id = 1  --> 读到 0（A 未提交）

如果 A 回滚：
  B 读到的数据是"脏"的（不存在的）
```

### 不可重复读（Non-Repeatable Read）

```
事务 B 在事务 A 内两次读同一行：
  第一次：SELECT balance FROM users WHERE id = 1  --> 100
  第二次：SELECT balance FROM users WHERE id = 1  --> 0（A 已提交并修改）

B 的两次读取结果不一致（不可重复）
```

### 幻读（Phantom Read）

```
事务 B 两次查询：
  第一次：SELECT * FROM users WHERE age > 18  --> 100 行
  第二次：SELECT * FROM users WHERE age > 18  --> 101 行（事务 A 新插入了一行）

"B 看到的数据行数变了，像幻觉一样"
```

## MVCC 实现

### 核心思想

```
每个事务看到的是某个时刻的数据库快照
读取时不加锁，写入时创建新版本

读：读取旧版本（快照）
写：创建新版本，不阻塞读
```

### InnoDB 的 MVCC

#### 隐藏列

```
每行有隐藏列：
  - DB_TRX_ID：最近一次修改的事务 ID
  - DB_ROLL_PTR：指向 undo log 的指针（用于构建旧版本）
  - DB_ROW_ID：行 ID（如果没有主键）
```

#### Undo Log（回滚日志）

```
版本链（版本链头是最新版本）：

事务 A (id=100) UPDATE: balance 100 -> 0
  创建 undo log：旧值 balance=100
  当前行：DB_TRX_ID=100, DB_ROLL_PTR -> undo

事务 B (id=101) SELECT: 读取时刻的读视图
  读视图：活跃事务列表 = [100]
  遍历版本链：
    - 当前行：DB_TRX_ID=101 > 读视图最小活跃事务
    - 不符合，查看 undo：DB_TRX_ID=100 在活跃列表中
    - 继续向上，找最早的不可见版本

最终 B 读到旧版本 balance=100
```

#### Read View（读视图）

```
Read View 包含：
  - m_ids：活跃事务 ID 列表
  - min_trx_id：最小活跃事务 ID
  - max_trx_id：创建 Read View 时的最大事务 ID
  - creator_trx_id：当前事务 ID

可见性判断：
  - trx_id < min_trx_id：可见（已提交）
  - trx_id >= max_trx_id：不可见（未来事务）
  - trx_id in m_ids：不可见（在读视图创建时还在活跃）
  - 否则：可见
```

### RC vs RR 的区别

```sql
-- RC（Read Committed）：每次 SELECT 都创建新的读视图
BEGIN;
SELECT balance FROM users WHERE id = 1;  -- 创建读视图 v1
                                                  -- 此时事务 A 提交
SELECT balance FROM users WHERE id = 1;  -- 创建读视图 v2（看到 A 的提交）
-- 两次读取结果不同（不可重复）

-- RR（Repeatable Read）：同一事务复用第一个读视图
BEGIN;
SELECT balance FROM users WHERE id = 1;  -- 创建读视图 v1
                                                  -- 事务 A 提交
SELECT balance FROM users WHERE id = 1;  -- 复用读视图 v1（A 未在 v1 的活跃列表中，所以看不到）
-- 两次读取结果相同（可重复）
```

### 幻读解决（Next-Key Lock）

```
InnoDB 的 RR 级别用 Next-Key Lock 避免幻读：

表：users (id, age), id 是主键, age 有索引
事务 A：INSERT INTO users VALUES (100, 25)

事务 B：SELECT * FROM users WHERE age > 18 FOR UPDATE

RR 级别：
  - B 的查询需要找到 age > 18 的记录
  - InnoDB 在索引上加 Next-Key Lock：[18, +∞)
  - 新插入 age=25 的记录会落入这个范围，被阻塞
  - 避免了幻读

RC 级别：
  - B 不需要在索引上加 Next-Key Lock
  - 但可能导致幻读
```

## 快照读 vs 当前读

### 快照读（Snapshot Read）

```
普通 SELECT（非 FOR UPDATE 非 LOCK IN SHARE MODE）
  - 读取的是快照版本
  - 不加锁

SELECT * FROM users WHERE id = 1;  -- 快照读
```

### 当前读（Current Read）

```
带锁的 SELECT 或 DML
  - 读取最新提交版本
  - 加锁

SELECT * FROM users WHERE id = 1 FOR UPDATE;  -- 当前读，加 X 锁
INSERT INTO users VALUES (...);  -- 当前读，加 IX 锁
UPDATE users SET ... WHERE id = 1;  -- 当前读，加 X 锁
```

### 读视图创建时机

```sql
-- 快照读：事务开始时创建读视图（RR）
BEGIN;  -- 事务开始
SELECT ...  -- 读视图在第一条 SELECT 时创建

-- 当前读：读取最新数据，加锁
SELECT ... FOR UPDATE  -- 读取最新数据，加锁
```

## Next-Key Lock

### 锁范围

```
索引：1, 3, 5, 7, 9
Next-Key Lock 区间：
  (-∞, 1], (1, 3], (3, 5], (5, 7], (7, 9], (9, +∞)

等值查询：
  SELECT * FROM t WHERE id = 5 LOCK IN SHARE MODE;
  - 如果存在：在 (3, 5] 上加 S 锁
  - 如果不存在：在 (3, 5] 上加 Next-Key Lock（阻止插入 id=5）

范围查询：
  SELECT * FROM t WHERE id > 3 AND id < 7 LOCK IN SHARE MODE;
  - 加锁区间：(3, 5], (5, 7)
  - id=5 本身加 S 锁，(5, 7) 加 Next-Key Lock
```

### 插入意向锁（Insert Intention Lock）

```
场景：事务 A 在 (3, 5] 上有 Next-Key Lock
事务 B 要插入 id=4

INSERT 操作先加 Insert Intention Lock：
  - 等待 A 释放锁
  - A 释放后，B 可以插入

Insert Intention Lock 不阻塞其他插入意向锁
```

## 核心追问

1. **RR 和 RC 的本质区别？** RR 在事务开始时创建读视图，整个事务复用；RC 每次 SELECT 都重新创建读视图
2. **幻读和不可重复读的区别？** 不可重复读：同一行数据两次读不一样；幻读：同一个查询返回了不同数量的行（新增或删除）
3. **MVCC 为什么能实现非阻塞读？** 读操作读取快照，不加锁；写操作创建新版本，阻塞的是当前读不是快照读
4. **为什么 RC 比 RR 快？** RC 不需要在整个事务周期维护读视图，每次 SELECT 都可以复用更新的快照；RR 需要在第一条 SELECT 时创建读视图并保持到事务结束
5. **Next-Key Lock 解决什么问题？** 在 RR 级别解决幻读：对索引加 Next-Key Lock，阻止其他事务在范围内插入新记录

## 状态

| 资产 | 状态 |
|---|---|
| B+Tree index deep dive | done |
| MVCC and isolation levels | done |
| WAL crash recovery notes | todo |
| slow query diagnosis playbook | todo |
| replication lag and consistency | todo |