# Replication Lag and Consistency

## 目标

理解主从复制延迟的原因、对业务的影响、以及如何解决一致性问题。

## 场景

- 写主库后立即读从库，读不到刚写的数据？
- 主从延迟过大怎么排查？
- 如何配置半同步复制？
- 从库延迟会影响哪些业务场景？

## 主从复制原理

### 异步复制（默认）

```
Master:
  1. 事务提交，写入 redo log
  2. binlog dump 线程发送到 Slave
  3. 不等待 Slave 确认

Slave:
  1. I/O 线程接收 binlog，写入 relay log
  2. SQL 线程读取 relay log，执行 SQL

特点：
  - Master 不等待 Slave 确认
  - 可能丢数据（Master 崩溃时）
  - 延迟不稳定
```

### 半同步复制（Semi-sync）

```
Master:
  1. 事务提交，写入 redo log
  2. 等待至少一个 Slave 确认收到 binlog
  3. 提交成功返回客户端

Slave:
  1. I/O 线程接收 binlog，写入 relay log
  2. 返回 ACK 给 Master

特点：
  - 至少一个 Slave 收到才返回成功
  - 比异步安全，比同步快
  - 可能有退化为异步的情况（Slave 超时）
```

### 组复制（MySQL Group Replication）

```
基于 Paxos 的多主复制：
  - 多个节点组成复制组
  - 事务在组内多数节点确认后提交
  - 强一致，但性能较低
```

## 延迟原因

### 1. 网络延迟

```
Master -> Slave：binlog 传输延迟
通常：1-5ms（同城机房）
     50-100ms（跨城）
     100ms+（跨洲）
```

### 2. 从库应用慢

```sql
-- SQL 线程单线程执行
-- 如果主库并发高，从库单线程跟不上

SHOW SLAVE STATUS\G
  -- Seconds_Behind_Master: 0 正常，非 0 说明延迟
  -- Relay_Log_Pos: 当前应用位置
```

### 3. 大事务

```sql
-- 问题
BEGIN;
UPDATE orders SET status = 'completed';  -- 1000万行
COMMIT;

-- 主库并行提交，从库单线程执行
-- 从库延迟可能达到分钟级

-- 解决：分批提交
for i in range(0, 10000000, 10000):
    UPDATE orders SET status = 'completed' LIMIT 10000;
```

### 4. 锁冲突

```sql
-- 从库 SQL 线程遇到锁等待
-- 阻塞后续语句执行

SHOW PROCESSLIST;
  -- Command: Binlog Dump
  -- State: Waiting for an event from relay log
  -- 但 SQL 线程可能 blocked
```

### 5. 硬件资源

```
从库机器资源紧张：
  - CPU 高：主库写并发高，从库应用慢
  - 磁盘 I/O：高负载下从库跟不上
  - 内存：InnoDB buffer pool 不够用

解决：给从库独立资源
```

## 延迟对业务的影响

### 读从库场景

```python
# 问题：刚写完就读取
user_id = db.write("INSERT INTO users ...")  # 主库写
user = db.read("SELECT * FROM users WHERE id = ?", user_id)  # 从库读
# 可能读不到，因为还没同步

# 解决：
# 1. 强制读主库
user = master_db.read("SELECT ...")

# 2. 写完后再等一下（不推荐）
time.sleep(0.5)
user = slave_db.read("SELECT ...")
```

### 读写分离场景

```python
# 常见方案：
# - 强制走主库：涉及写的读、刚写入的数据
# - 走从库：历史数据、无一致性要求的读

def get_user(user_id):
    # 查询 1 秒内写入的，走主库
    if db.is_recent_write(user_id):
        return master_db.query("SELECT * FROM users WHERE id = ?", user_id)
    else:
        return slave_db.query("SELECT * FROM users WHERE id = ?", user_id)
```

### 延时敏感业务

```
延时敏感场景（不能接受延迟）：
  - 支付结果查询（可能刚付完查不到）
  - 下单后查订单状态
  - 库存扣减后查余量

方案：
  - 所有写后读走主库
  - 配合强制路由中间件
```

## 延迟监控

```sql
-- 查看延迟
SHOW SLAVE STATUS\G
  -- Seconds_Behind_Master: 0 表示正常

-- Pt-heartbeat
pt-heartbeat -h master_host -D test_db --update

-- 从 relay log 位置判断
SHOW SLAVE STATUS\G
  -- Read_Master_Log_Pos: 主库 binlog 位置
  -- Relay_Log_Pos: 从库已应用位置
  -- 差值 = 延迟字节数

-- 监控脚本
while true; do
    lag=$(mysql -e "SHOW SLAVE STATUS\G" | grep Seconds_Behind_Master | awk '{print $2}')
    if [ $lag -gt 60 ]; then
        echo "ALERT: Slave lag ${lag}s"
    fi
    sleep 10
done
```

## 解决方案

### 1. 并行复制

```sql
-- MySQL 5.7+ 支持并行复制
SHOW VARIABLES LIKE 'slave_parallel_type';
-- DATABASE: 按库并行（同一库内串行）
-- LOGICAL_CLOCK: 组提交并行（同一组提交的可以并行）

SET GLOBAL slave_parallel_workers = 8;  -- 8 个 worker 线程

-- 效果：
-- 主库并发提交，从库可以并行应用
-- 显著减少延迟
```

### 2. 配置半同步

```sql
-- 主库
INSTALL PLUGIN rpl_semi_sync_master SONAME 'semisync_master.so';
SET GLOBAL rpl_semi_sync_master_enabled = 1;
SET GLOBAL rpl_semi_sync_master_timeout = 1000;  -- ms

-- 从库
INSTALL PLUGIN rpl_semi_sync_slave SONAME 'semisync_slave.so';
SET GLOBAL rpl_semi_sync_slave_enabled = 1;

-- 查看状态
SHOW STATUS LIKE 'rpl_semi%';
```

### 3. 读写分离路由

```python
# 应用层路由
class Router:
    def read(self, query):
        if 'recent_write' in query.context:
            return self.master
        return self.slave  # 默认读从库

    def write(self, query):
        return self.master  # 写总是主库
```

### 4. GTID 复制

```sql
-- GTID：全局事务 ID
SET GLOBAL gtid_mode = ON;
SET GLOBAL enforce_gtid_consistency = ON;

-- 优点：
-- - 更容易判断延迟
-- - 自动跳过错误事务
-- - 更容易做故障切换

SHOW MASTER STATUS;  -- 显示 GTID_EXECUTED
```

## 主从延迟的业务场景分析

| 场景 | 影响 | 解决方案 |
|---|---|---|
| 刚写入就读 | 读不到 | 强制读主库 / 等几毫秒 |
| 统计报表 | 数据滞后 | 可接受，定时任务可以容忍 |
| 实时大屏 | 数据不准确 | 不走从库，实时查主库 |
| 秒杀库存 | 超卖可能 | 不走从库，乐观锁/分布式锁 |
| 支付查状态 | 体验问题 | 强制读主库 |

## 核心追问

1. **主从延迟的常见原因？** 大事务、SQL 线程单线程、从库硬件资源不足、网络延迟
2. **半同步复制能完全避免丢数据吗？** 不能。Slave ACK 超时后会退化为异步，仍可能丢数据；组复制才能真正保证不丢
3. **写完立即读走主库还是从库？** 走主库。从库可能还没同步到最新写入
4. **并行复制的原理？** 基于主库组提交（group commit）的事务，slave 可以并行执行同一组的事务，因为它们在主库已提交
5. **Seconds_Behind_Master 为 0 就能保证没有延迟吗？** 不一定。如果从库的 I/O 线程和 SQL 线程都在运行但网络断了，实际延迟可能无法反映；或者从库机器时间不同步也会有误导

## 状态

| 资产 | 状态 |
|---|---|
| B+Tree index deep dive | done |
| MVCC and isolation levels | done |
| WAL crash recovery notes | done |
| slow query diagnosis playbook | done |
| replication lag and consistency | done |