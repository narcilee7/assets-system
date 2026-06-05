# WAL Crash Recovery

## 目标

理解 Write-Ahead Logging（WAL）的机制：redo log、undo log、崩溃恢复流程、LSN 和检查点。

## 场景

- 数据库崩溃后如何恢复？
- redo log 和 undo log 的区别？
- 为什么 redolog 写完了就安全，但数据页还没落盘？
- 检查点（checkpoint）的作用是什么？

## WAL 核心原理

```
Write-Ahead Logging（预写日志）：

数据修改：
  1. 先写 redo log（持久化到磁盘）
  2. 再修改内存中的数据页
  3. 后台进程异步将数据页刷盘

崩溃恢复：
  - redo log 在数据页之前，恢复未刷盘的数据
  - 确保已提交事务不丢失

原则：数据页刷盘前，对应的 redo log 必须先刷盘
```

## Redo Log

### 作用

```
crash-safe：
  - 事务提交后，即使数据页还没刷盘，崩溃重启也能恢复
  - 因为 redo log 已经持久化，包含所有修改

流程：
  1. UPDATE t SET x=1 WHERE id=1;
  2. 记录 redo log：page_id=5, offset=100, x=1
  3. 修改内存页（此时内存有新值，磁盘还是旧值）
  4. 后台 checkpoint 将内存页刷盘
  5. 如果在第 4 步之前崩溃，重启时读 redo log 恢复
```

### 结构

```
InnoDB redo log 组成：
  - log buffer：内存中的日志缓冲
  - log file：磁盘上的日志文件（ib_logfile0, ib_logfile1）

日志格式（逻辑）：
  LSN 1000: page_id=5, offset=100, old=0, new=1
  LSN 1100: page_id=5, offset=104, old=0, new=2

LSN（Log Sequence Number）：
  - 单调递增的日志序号
  - 用于标记日志位置和恢复起点
```

### 写入机制

```sql
-- 事务提交时
INNODB_flush_log_at_trx_commit = 1（默认）：
  - 每事务提交，redo log 必须 fsync 到磁盘
  - 最安全，性能最差

INNODB_flush_log_at_trx_commit = 2：
  - 每事务提交，redo log 写到 OS buffer（不 fsync）
  - OS 崩溃可能丢 1 秒数据
  - 性能最好

INNODB_flush_log_at_trx_commit = 0：
  - 每秒刷盘一次
  - 最快但可能丢 1 秒数据
```

### 崩溃恢复流程

```
恢复步骤：
  1. 读取 redo log 文件，找到最后一个检查点
  2. 从检查点开始，应用 redo log
  3. 将内存中未刷盘的已提交事务重做
  4. 回滚未提交事务（需要 undo log）

关键：
  - 已提交事务：redo log 存在，提交标志 -> 重做
  - 未提交事务：需要 undo log 回滚
  - 脏页（未提交修改）：不重做
```

## Undo Log

### 作用

```
回滚（Rollback）：
  - 事务失败时，用 undo log 恢复到修改前的状态
  - 逻辑地"撤销"修改

MVCC：
  - 为旧版本提供"原材料"
  - 构建事务开始时的快照（读视图）

undo log 记录的是"逆操作"：
  UPDATE t SET x=1 WHERE x=0;
  undo: UPDATE t SET x=0 WHERE x=1;
```

### 存储位置

```
undo log 存储在系统表空间（innodb_system_tablespace）
  - 回滚段（rollback segment）
  - 每个回滚段有 1024 个 undo slot
  - 每个事务分配一个 undo slot

undo page 结构：
  - update undo log：用于 UPDATE 操作
  - insert undo log：用于 INSERT 操作（可以立即释放）
```

### 清理

```sql
-- insert undo log：事务提交后立即清理

-- update undo log：需要等所有快照读结束
  - 如果有事务还在读旧版本，不能清理
  - purge 线程在无活跃事务时清理

-- 监控
SHOW ENGINE INNODB STATUS;
  -- 看到：TRANSACTIONS: trx id 1234, undo NNNN -- length N
```

## Checkpoint

### 作用

```
定期将内存中的脏页刷盘
减少崩溃恢复时间

checkpoint 之前的数据已经安全（已落盘或已记录 redo）
崩溃恢复只需要从 checkpoint 开始
```

### 模糊 checkpoint vs sharp checkpoint

```
Sharp Checkpoint（MySQL 5.6 之前）：
  - 将所有脏页刷盘
  - 恢复时从日志开头开始
  - 影响性能

Fuzzy Checkpoint（现代 InnoDB）：
  - 定期刷新部分脏页
  - 从最近的 checkpoint 开始恢复
  - 不阻塞正常写入
```

### checkpoint 触发条件

```
1. master thread 每秒检查：
   - 脏页数 > 阈值 -> 刷新
   - redo log 空间 > 阈值 -> 刷新

2. 脏页比例 > innodb_max_dirty_pages_pct：
   - 强制刷新

3. redo log 切换：
   - 当前 redo log 快写满时
   - 触发 checkpoint，释放空间
```

## 崩溃恢复详细流程

```
步骤 1：定位检查点
  - 读取日志文件头，找到最后一个 checkpoint LSN

步骤 2：扫描 redo log
  - 从 checkpoint LSN 开始扫描
  - 收集所有已提交事务的 redo

步骤 3：重做（Redo）
  - 对每个已提交事务：
    - 读取 redo log
    - 恢复内存中的数据页

步骤 4：回滚（Undo）
  - 对未提交事务：
    - 读取 undo log
    - 执行逆操作恢复原值
```

## Double Write Buffer

### 问题

```
部分页写入（Partial Page Write）：
  - 写数据页时崩溃（16KB 页只写了 8KB）
  - 页 checksum 对不上，被检测为损坏

解决：Double Write Buffer
  - 先将页顺序写到 doublewrite buffer（2MB）
  - 然后写到实际位置
  - 恢复时从 doublewrite buffer 恢复损坏的页
```

### 流程

```
写页：
  1. 内存 -> doublewrite buffer（fsync）
  2. doublewrite buffer -> 实际位置（fsync）

恢复：
  - 如果实际位置页 checksum 错误
  - 从 doublewrite buffer 读取备份
```

## L2：源码锚定与边界陷阱

### InnoDB 关键函数

| 阶段 | 函数 | 文件 |
|---|---|---|
| redo 写入 | `log_write_up_to` | storage/innobase/log/log0log.cc |
| 事务提交刷盘 | `trx_commit_complete_for_mysql` → `trx_flush_log_if_needed` | storage/innobase/trx/trx0trx.cc |
| checkpoint | `log_checkpoint` | storage/innobase/log/log0log.cc |
| 恢复开始 | `recv_recovery_from_checkpoint_start` | storage/innobase/log/log0recv.cc |
| 重做应用 | `recv_apply_hashed_log_recs` | storage/innobase/log/log0recv.cc |
| 回滚未提交 | `trx_roll_or_clean_recovered` | storage/innobase/trx/trx0trx.cc |
| Doublewrite | `buf_dblwr_write_block_to_datafile` | storage/innobase/buf/buf0dblwr.cc |

### `innodb_flush_log_at_trx_commit` 的精确语义

| 值 | 行为 | 崩溃安全 | 性能 |
|---|---|---|---|
| 0 | 每秒刷盘（master thread） | 可能丢 1 秒数据 | 最高 |
| 1 | 每次事务提交 `fsync` redo log | 零数据丢失 | 最低 |
| 2 | 每次事务提交写入 OS page cache | OS 崩溃可能丢 1 秒数据 | 中等 |

关键区别在 `1` 和 `2`：
- `1` 调用 `fsync()` 保证 redo log 落盘，但 `fsync` 是 syscall，高并发时成为瓶颈。
- `2` 只写入 OS buffer，由操作系统决定刷盘时机。如果 **MySQL 进程崩溃但 OS 不崩溃**，数据不会丢；如果 **整台机器掉电**，可能丢 1 秒。

### 边界陷阱

1. **Checkpoint 不保证数据页已落盘**：
   Fuzzy Checkpoint 只记录一个 LSN，表示“此 LSN 之前的 redo log 所对应的数据页**应该**已落盘”。如果实际没落盘，恢复时 redo 会再次应用（幂等）。

2. **Doublewrite Buffer 不是备份**：
   它只保护**部分页写入**（16KB 写了一半）。如果整个磁盘损坏，Doublewrite Buffer 也救不了，需要物理备份或 RAID。

3. **Redo log 大小影响写入性能**：
   redo log 文件（`ib_logfile0/1`）太小会导致频繁 checkpoint，脏页频繁刷盘，I/O 抖动。MySQL 8.0 推荐 `innodb_log_file_size * innodb_log_files_in_group >= 1~2GB`。

## L3：可运行实验

见 `impl/wal_lab/`：

```bash
cd systems-engineering/database-systems/impl/wal_lab
python3 wal_simulator.py
```

脚本模拟：
- 事务提交 → redo log 落盘
- Checkpoint 更新 LSN
- 崩溃丢失内存页
- 恢复时从 checkpoint LSN 开始 REDO

## 核心追问

1. **为什么 redo log 写完了就安全？** WAL 原则：数据页刷盘前，对应的 redo log 必须先刷盘。只要 redo log 持久化了，即使数据页还没刷盘，崩溃后也能从 redo log 恢复
2. **redo log 和 binlog 的区别？** redo log 是引擎层(InnoDB)的物理日志，记录页修改；binlog 是服务层的逻辑日志，记录 SQL 语句；崩溃恢复用 redo log，主从复制用 binlog
3. **LSN 是什么？** Log Sequence Number，redo log 的序号，用于标记日志位置、恢复起点、计算已写入的日志量
4. **checkpoint 的作用是什么？** 将内存中的脏页刷盘，将已确认安全的日志位置记录下来，这样崩溃恢复只需要从 checkpoint 开始，不需要从头开始应用所有日志
5. **为什么需要 doublewrite buffer？** 防止部分页写入导致的数据页损坏。如果只有 8KB 写入就崩溃了，没有 doublewrite buffer 恢复时无法知道这 8KB 是什么内容

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| B+Tree index deep dive | L1 | done |
| MVCC and isolation levels | L2+L3 | done |
| WAL crash recovery notes | **L2+L3** | **done** |
| slow query diagnosis playbook | L2+L3 | done |
| replication lag and consistency | L1 | todo |