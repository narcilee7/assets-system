# Distributed Lock Critique

## 目标

理解分布式锁的实现、常见陷阱、以及 RedLock 等算法的局限性。

## 场景

- 如何用 Redis/ZooKeeper 实现分布式锁？
- 单点 Redis 锁为什么不够可靠？
- RedLock 为什么有争议？
- 锁的 FIFO、公平性、可重入怎么实现？

## 核心问题

**分布式锁的问题**：
1. 互斥（Mutual Exclusion）
2. 无死锁（No Deadlock）
3. 容错（Fault Tolerance）
4. 公平性（Fairness）

## Redis 单实例锁

### 基本实现

```
SET key value NX PX 30000

- NX: 仅当 key 不存在时设置（互斥）
- PX 30000: 过期时间 30 秒（防死锁）

释放锁（Lua 脚本）：
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end

- 用唯一值标识（防止误删其他客户端的锁）
```

### 问题

**问题 1：客户端崩溃后锁不释放**
- 解决：设置 TTL，锁自动过期
- 但：TTL 太短可能被误删（任务未完成），太长则响应慢

**问题 2：Redis 主从切换后锁丢失**
```
客户端 A 在 Redis Master 上获取锁
Master 崩溃，复制到 Slave 前宕机
从 slave 晋升为新 master
客户端 B 在新 master 上获取同一把锁（成功！）
--> 两把锁同时存在，不互斥
```

**问题 3：时钟跳跃（不可信场景）**
- Redlock 依赖多个 Redis 实例时钟一致
- 但时钟跳跃会导致锁提前过期

## RedLock 算法

### 5 个独立 Redis 实例

```
客户端：
  1. 获取当前时间 T1
  2. 按顺序向 5 个实例发送 SET key value NX PX timeout
  3. 获取当前时间 T2
  4. 计算成功数量：多数 = 3

成功条件：
  - 获得多数（N/2 + 1 = 3）个锁
  - 且 (T2 - T1) < TTL
  
锁的有效时间 = TTL - (T2 - T1)

如果成功，锁有效
如果失败，释放所有锁
```

### RedLock 的争议

**争议点 1：时钟依赖**
```
5 个 Redis 实例分布在不同机器
如果其中一个实例时钟快跳 10 秒：
  - 该实例的锁会"看起来"更早过期
  - 实际锁还没过期，但其他实例认为它已过期

Martin Kleppmann 的批评：
  - Redlock 假设 NTP 可以保证时钟同步
  - 但 NTP 本身不能提供强保证
  - 如果一个实例的时钟跳跃，安全性被破坏
```

**争议点 2：半同步问题**
```
客户端获取了 3/5 个锁，但：
- 实例 1 和 2 确实拿到了
- 实例 3 的响应丢了（网络问题）

客户端认为成功，但实际上 3 没拿到
客户端以为自己有锁，但实际只有 2/5

如果客户端继续操作，会产生数据竞争
```

**争议点 3：fencing token 缺失**
```
没有 fencing token（单调递增版本号），无法保证：
  - 后续的写请求一定在锁释放之后

即使 Redis 锁释放了：
  - 客户端 A 的写请求可能延迟
  - 客户端 B 获取锁后写入
  - 客户端 A 的延迟写到达，覆盖 B 的写入
```

## Redisson 分布式锁

### 可重入锁（Reentrant）

```
hset lock:{key} {unique_id} 1
hincrby lock:{key} {unique_id} 1

- 同一线程可以多次获取同一把锁
- 每次获取 +1，每次释放 -1
- 减到 0 删除 key

问题：Redis 单点，不是真正分布式
```

### 看门狗（Watch Dog）自动续期

```
场景：任务执行时间超过 TTL

实现：
  - 获取锁后，启动后台线程
  - 每 (TTL/3) 秒检查：锁是否还在
  - 如果还在，延长 TTL
  
好处：
  - 避免任务没完成锁就过期
  - 不需要精确预估任务时间

Java:
  lock.lock(10, TimeUnit.SECONDS);
  // 看门狗自动续期：每 3 秒续一次
  // 如果当前线程持有锁，每次续 10 秒
```

## ZooKeeper 分布式锁

### 实现方式

```
临时有序节点（Ephemeral Sequential）：

1. 创建节点：/locks/my-lock/guid-0000000001
2. 获取所有子节点，排序
3. 如果自己是最小的，获取锁成功
4. 否则，监听前一个节点

释放锁：删除自己的节点
```

### 优点

1. **自动清理**：客户端崩溃，临时节点自动删除
2. **有序性**：保证公平锁（FIFO）
3. **原子性**：创建节点是原子的
4. **一致性**：ZAB 协议保证强一致

### 缺点

1. **性能**：每次获取锁需要读写 ZooKeeper
2. **依赖**：ZooKeeper 集群本身需要高可用

## 数据库分布式锁

### 表锁

```sql
SELECT * FROM locks WHERE name = 'my-lock' FOR UPDATE;
-- 事务提交后自动释放
```

### 行锁

```sql
INSERT INTO locks (name, owner, expire_at)
VALUES ('my-lock', 'client-123', NOW() + INTERVAL 30 SECOND)
ON DUPLICATE KEY UPDATE ...;
-- 检查 expire_at，过期才允许获取
```

问题：性能差，没有续期机制，异常后 expire_at 需要后台清理

## 对比总结

| 方案 | 一致性 | 性能 | 自动续期 | 公平锁 | 典型场景 |
|---|---|---|---|---|---|
| Redis 单点 | 弱（主从切丢锁） | 高 | Redisson 看门狗 | 否 | 简单互斥，容忍小概率失效 |
| RedLock | 弱（时钟依赖） | 中 | 否 | 否 | 多 Redis 实例，需要更高可靠性 |
| ZooKeeper | 强 | 中 | 否（临时节点） | 是 | 强一致需求，金融级 |
| 数据库 | 强 | 低 | 否 | 否 | 简单场景，不追求性能 |

## L2：源码锚定与边界陷阱

### 源码锚定

| 实现 | 关键源码/命令 | 说明 |
|---|---|---|
| Redis SET NX | `t_string.c` 中 `setGenericCommand` | `NX` 在 key 不存在时通过 `lookupKeyWrite` 检查后原子写入；Lua 释放锁用 `EVAL` 保证 get+del 原子性 |
| Redis RedLock | `redlock.c`（redis 源码中无内置实现，参考 antirez/redlock-py） | 核心逻辑：向 N 个实例获取锁，成功数 ≥ N/2+1 且总耗时 < TTL；有效时间 = TTL - 获取耗时 |
| ZooKeeper 临时有序节点 | `DataTree.java` 中 `createNode`（ephemeral + sequential flag） | session 断开时 `killSession` 遍历 ephemeral map 删除节点；watcher 通知前一个节点删除事件 |
| etcd CAS | `mvcc/kvstore_txn.go` 中 `Txn` | 基于 revision 的 Compare-And-Swap；事务内可组合多个 compare + success/fail 操作 |
| Redisson Watchdog | `RedissonLock.java` 中 `scheduleExpirationRenewal` | 启动 `TimerTask` 每 `lockWatchdogTimeout/3`（默认 10s）续期；只有持有锁的线程能续期 |

### 边界陷阱

1. **Redis 主从异步复制丢锁**：主节点写锁成功后立即宕机，锁未同步到从节点；从节点晋升后新客户端可获取同一把锁。RedLock 不解决单实例故障，只降低概率
2. **时钟跳变摧毁 RedLock**：某实例时钟快跳 10s，其锁提前过期，其他实例仍认为锁有效；NTP 同步不能杜绝闰秒、手动调时
3. **客户端 GC pause 超过 TTL**：Java 应用 STW 30s，看门狗线程暂停，锁在 Redis 中已过期，但客户端仍认为持有锁，继续操作产生竞态
4. **看门狗在客户端崩溃后"永久锁"**：客户端获取锁后进程崩溃（非优雅退出），看门狗停止，锁按 TTL 自动释放；但如果 TTL 设得很长（如 5 分钟），故障期间其他客户端长时间阻塞
5. **RedLock 的 fencing token 缺失**：客户端 A 获取锁后写请求延迟，锁过期后客户端 B 获取锁并写入，A 的延迟写到达后覆盖 B 的数据；RedLock 没有单调递增 token 供存储层校验
6. **ZooKeeper 的羊群效应**：大量客户端同时监听最小节点，最小节点删除时所有客户端同时唤醒争抢；Curator 的 `InterProcessMutex` 通过监听前一个节点而非最小节点来缓解
7. **ZooKeeper session timeout 误判**：客户端与 ZK 集群网络闪断，session timeout 内重连成功则保持锁；timeout 外重连则 session 过期锁释放，但客户端本地可能未及时感知
8. **脑裂导致 Redis Sentinel 双主**：Sentinel 配置 `min-slaves-to-write` 不当或网络分区时，两个分区各选举出一个 master，两边客户端都能获取锁

## L3：可运行实验

> 实验目录：`systems-engineering/distributed-systems/impl/dlock_lab/`

### 实验 1：Redis 单实例锁（含 TTL 与误删）

```bash
cd systems-engineering/distributed-systems/impl/dlock_lab
python3 redis_lock.py --ttl 5 --task-time 8
```

模拟 Redis 单实例锁：任务执行时间 8s 超过 TTL 5s，锁提前释放后其他客户端获取锁，展示并发冲突。对比加入看门狗续期后的安全性。

### 实验 2：RedLock 多数派模拟

```bash
python3 redlock_sim.py --nodes 5 --quorum 3 --delay 0.1 --ttl 10
```

模拟 5 个 Redis 节点，客户端依次请求加锁，引入网络延迟；统计成功获取多数派的比例，以及因超时而判定失败的案例。

### 实验 3：ZooKeeper 临时有序锁

```bash
python3 zk_lock.py --clients 5 --contention 100
```

用本地文件系统模拟 ZK 临时有序节点：每个客户端创建临时文件，按文件名排序获取锁，监听前一个节点删除事件；统计公平性（FIFO 顺序）和羊群效应程度。

### 实验 4：Fencing Token 保护写入

```bash
python3 fencing_token.py --delay 2
```

模拟 fencing token 场景：客户端 A 获取锁（token=1）后延迟写入，锁过期后客户端 B 获取锁（token=2）并写入；存储层拒绝 token=1 的延迟写，防止数据覆盖。

## 核心追问

1. **为什么 Redis 单点锁不够可靠？** 主从切换时锁可能丢失，需要 RedLock 或其他方案
2. **RedLock 的争议点？** 时钟依赖、响应丢失导致误判、不提供 fencing token
3. **分布式锁和 Redis 缓存的区别？** 锁是"有则不用，没有则创建"，缓存是"读缓存，无则查数据库"
4. **为什么需要 fencing token？** 防止客户端崩溃后延迟的写请求覆盖新 leader 的写入
5. **看门狗机制的作用？** 避免任务执行时间超过预估的 TTL，导致锁提前释放

## 工程迁移

- **Redis**：Redisson 实现，懒续期，适合简单互斥
- **ZooKeeper**：Curator 实现，强一致，适合金融级
- **数据库**：最后兜底方案，不推荐高性能场景

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| Raft walkthrough | L3 | done |
| distributed lock critique | L3 | done |
| message delivery semantics | L1 | todo |
| sharding and rebalance playbook | L1 | todo |
| consistency model comparison | L1 | todo |