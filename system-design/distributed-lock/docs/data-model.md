# Data Model

## 核心设计原则

- **owner 必须唯一**：解锁时校验 owner，防止误删
- **TTL 必须设置**：持锁方崩溃后锁能自动释放
- **状态可观测**：锁的剩余 TTL、当前 owner 必须可查
- **续期原子性**：续期操作必须原子（Lua 脚本）

---

## 1. Redis 锁数据结构

### 1.1 基础互斥锁（最常用）

```
Redis Key 结构：

  Key:     lock:{business}:{resource_id}
  Value:   {owner_id}     # 持锁方唯一标识（UUID）
  TTL:     30000          # 30s 过期

示例：
  Key:   "lock:order:pay:12345"
  Value: "worker-abc-uuid-xxx"
  TTL:   30000ms
```

**为什么 Value 是 UUID？**
- 解锁时校验："只有我自己能解锁自己"
- 防止误删别人的锁（场景：业务执行慢 → TTL 过期 → 别人拿到锁 → 我解锁时误删别人的）

### 1.2 Redisson Hash 结构（可重入锁）

```
Redis Key：lock:{business}:{resource_id}

Hash 结构：
  HSET lock:order:pay:12345
    "uuid:thread-1" 1     # 线程 1 加锁 1 次（可重入）
    "uuid:thread-2" 2     # 线程 2 加锁 2 次
    "uuid:thread-3" 1     # 线程 3 加锁 1 次
  TTL: 30000ms            # 整个 Hash 共享一个 TTL

加锁 Lua 脚本：
  if redis.call('exists', KEYS[1]) == 0 then
      redis.call('hincrby', KEYS[1], ARGV[1], 1)
      redis.call('pexpire', KEYS[1], ARGV[2])
      return 1
  elseif redis.call('hexists', KEYS[1], ARGV[1]) == 1 then
      redis.call('hincrby', KEYS[1], ARGV[1], 1)
      redis.call('pexpire', KEYS[1], ARGV[2])
      return 1
  else
      return 0
  end
```

**可重入的好处**：
- 同一线程递归调用不会死锁
- 业务调用栈深处仍然能正确解锁

### 1.3 Redisson 公平锁（ZSet）

```
Redis Key：
  lock:{business}:{resource_id}            # 锁状态（Hash）
  redisson_lock_queue:{business}:{...}     # 等待队列（ZSet）

ZSet（按时间戳排序）：
  ZADD redisson_lock_queue:order:pay:12345
    1704067201000 "worker-uuid-1"
    1704067201500 "worker-uuid-2"
    1704067202000 "worker-uuid-3"

加锁流程：
  1. 检查自己是不是队列头部
  2. 如果是 + 锁空闲 → 加锁成功
  3. 否则 → 等待，直到自己变成头部

解锁流程：
  1. 从 Hash 删除
  2. 从 ZSet 删除
  3. 通知下一个等待者
```

### 1.4 看门狗续期数据结构

```
锁 key：lock:order:pay:12345
TTL：30s（初始）

看门狗续期：
  每 10s 执行 Lua 脚本：
    if redis.call('hget', KEYS[1], ARGV[1]) ~= false then
        return redis.call('pexpire', KEYS[1], ARGV[2])
    else
        return 0
    end

续期成功：pexpire 30000 → key 续命 30s
续期失败：返回 0（key 已不存在）→ 客户端放弃持锁

Redis 9.0+ 看门狗：
  - 支持 wait / notif 等新指令
  - 但实际生产仍然用 Lua 脚本续期
```

---

## 2. Redis Key 设计模式

### 2.1 命名规范

```
lock:{业务}:{场景}:{资源 ID}

示例：
  lock:order:pay:12345           # 订单支付锁
  lock:inventory:deduct:sku789   # 库存扣减锁
  lock:user:profile:abc          # 用户资料锁
  lock:scheduled:job:report      # 定时任务锁
  lock:distributed:leader        # Leader 选举
```

### 2.2 Key 长度控制

```
短 key（推荐）：
  lock:order:123:pay   → 19 字符

长 key（避免）：
  lock:order:user_id=123:product_id=456:warehouse=shanghai:deduct  → 70 字符

影响：
  - Redis 是单线程，key 越长越占内存
  - 网络传输也变慢
  - 建议 key < 50 字符
```

### 2.3 Key 数量控制

```
Redis 单实例 key 数量：
  - 性能拐点：1000W keys（小 key）
  - 危险拐点：1 亿 keys
  - 锁 key 一般生命周期短（30s TTL），不会堆积
  - 但要监控：redis.dbsize 指标
```

---

## 3. owner 标识设计

### 3.1 Java owner（Redisson）

```java
// Redisson 默认使用 UUID + 线程 ID
String ownerId = UUID.randomUUID().toString() + ":" + Thread.currentThread().getId();
// 示例: "f47ac10b-58cc-4372-a567-0e02b2c3d479:123"

// 客户端：每个 RedissonLock 实例一个 UUID
// 线程：每次 lock.lock() 的当前线程
```

### 3.2 Go owner

```go
// bsm/redislock 使用传入的 Metadata 字段
lock := client.Obtain(key, &redislock.Options{
    Metadata: "worker-pod-abc",  // 自定义 owner
})
```

### 3.3 owner 设计原则

```
原则 1：唯一性
  - UUID v4（128-bit）足够唯一
  - 或 UUID + hostname + pid

原则 2：可追溯
  - owner 中带 hostname/pod_id/thread_id
  - 排查锁问题时能定位到具体持锁方

原则 3：可校验
  - 解锁时比对 owner
  - 失败时报"owner mismatch"

原则 4：避免变化
  - 同一持锁方多次续期，owner 不能变
  - 否则续期失败
```

---

## 4. 锁状态查询模型

### 4.1 Redis 命令查询

```bash
# 查询锁是否存在
EXISTS lock:order:pay:12345

# 查询 TTL（毫秒）
PTTL lock:order:pay:12345
# -2: key 不存在
# -1: key 存在但无 TTL（异常情况）
# >0: 剩余毫秒数

# 查询 owner
GET lock:order:pay:12345
```

### 4.2 监控指标

```go
var (
    lockHoldCount = prometheus.NewCounterVec(  // 持锁次数
        prometheus.CounterOpts{Name: "lock_hold_total"},
        []string{"key", "result"},  // result: acquired | failed
    )

    lockHeldGauge = prometheus.NewGaugeVec(  // 当前持锁数
        prometheus.GaugeOpts{Name: "lock_held"},
        []string{"key"},
    )

    lockWaitTime = prometheus.NewHistogramVec(  // 等待时长
        prometheus.HistogramOpts{
            Name: "lock_wait_seconds",
            Buckets: []float64{0.001, 0.01, 0.1, 1, 5, 10, 30},
        },
        []string{"key"},
    )

    lockHeldTime = prometheus.NewHistogramVec(  // 持锁时长
        prometheus.HistogramOpts{
            Name: "lock_held_seconds",
            Buckets: []float64{0.01, 0.1, 1, 5, 30, 60, 300},
        },
        []string{"key"},
    )

    lockRenewTotal = prometheus.NewCounterVec(  // 续期次数
        prometheus.CounterOpts{Name: "lock_renew_total"},
        []string{"key", "result"},  // result: success | failed
    )
)
```

---

## 5. 分布式锁 vs 分布式事务

```
混淆点：
  分布式锁解决"互斥"（同时只能有一个）
  分布式事务解决"原子性"（要么全成要么全败）

不能用分布式锁实现分布式事务：
  - 锁粒度只能到"资源"
  - 事务涉及多个资源的协调
  - 锁失败时无法回滚已成功的操作

正确关系：
  - 分布式事务包含多个分布式锁
  - 事务内每个资源的修改都加锁保护
  - 但事务本身需要 2PC / Saga / TCC 实现
```

---

## 6. ZooKeeper 锁模型（对比）

### 6.1 ZK 临时顺序节点

```
锁路径：/lock_root/order:pay:12345/lock_

节点结构：
  /lock_root/order:pay:12345/lock_00000001  # 客户端 A
  /lock_root/order:pay:12345/lock_00000002  # 客户端 B
  /lock_root/order:pay:12345/lock_00000003  # 客户端 C

加锁：
  1. 在 lock_ 下创建临时顺序节点（zk.create）
  2. 获取所有子节点，判断自己是否最小
  3. 如果最小 → 加锁成功
  4. 否则 → 监听前一个节点（zk.exists + watch）
  5. 前一个节点删除 → 重新判断

解锁：
  - 直接删除自己的节点（zk.delete）
  - 会话断开 → 临时节点自动删除（兜底）
```

### 6.2 ZK vs Redis

```
ZK 优势：
  - 强一致（CP）
  - 临时节点自动过期（不用 TTL）
  - 监听机制（公平锁易实现）

ZK 劣势：
  - 写性能差（1W QPS）
  - 部署复杂（需要 ZK 集群）
  - 客户端重（Curator 依赖）

Redis 优势：
  - 写性能高（10W QPS）
  - 部署简单
  - 客户端轻

Redis 劣势：
  - 主从切换可能丢锁
  - TTL 需要看门狗
```

---

## 7. 数据库锁模型（对比）

### 7.1 悲观锁

```sql
-- 加锁：SELECT ... FOR UPDATE
BEGIN;
SELECT * FROM orders WHERE id = 12345 FOR UPDATE;
-- 此时其他事务的 FOR UPDATE 会被阻塞
UPDATE orders SET status = 'paid' WHERE id = 12345;
COMMIT;

特点：
  - 真正的"强一致"
  - 性能最差（行锁）
  - 死锁风险（多个事务交叉锁定）
```

### 7.2 唯一约束锁

```sql
-- 建表
CREATE TABLE distributed_lock (
    lock_key VARCHAR(128) PRIMARY KEY,
    owner VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL
);

-- 加锁
INSERT INTO distributed_lock (lock_key, owner, expires_at, created_at)
VALUES ('order:pay:12345', 'worker-uuid', NOW() + INTERVAL 30 SECOND, NOW());

-- 加锁失败（duplicate key）
Duplicate entry 'order:pay:12345' for key 'PRIMARY'

-- 解锁
DELETE FROM distributed_lock
WHERE lock_key = 'order:pay:12345' AND owner = 'worker-uuid';

-- 自动清理过期锁
DELETE FROM distributed_lock WHERE expires_at < NOW();
```

**特点**：
- 强一致（依赖 DB 事务）
- 性能最差（1K QPS）
- 适合强一致 + 低频场景（如金融对账）

---

## 8. 锁生命周期

```
生命周期：

  加锁成功
     │
     ▼
  ┌────────┐
  │ 持锁中 │ ← 业务执行
  └───┬────┘
      │
      │ 业务完成 / 异常
      ▼
  ┌────────┐
  │ 解锁中 │ ← 原子解锁（Lua）
  └───┬────┘
      │
      ├─────────────────────┐
      ▼                     ▼
  ┌────────┐          ┌────────┐
  │ 已释放 │          │ TTL过期│（持锁方崩溃）
  └────────┘          └────────┘

异常路径：
  - 持锁方崩溃 → 看门狗停止 → TTL 过期 → 锁自动释放
  - 看门狗续期失败 → 主动放弃 → 业务回滚
  - 网络分区 → 持锁方不可达 → TTL 过期 → 锁释放 → 另一个客户端拿到锁
```

---

## 9. 数据规模估算

```
假设：
  - 业务数 = 50 个
  - 每个业务独立锁 key
  - 锁粒度按业务分

锁 key 数量：
  - 高峰期：约 10W 个活跃锁（每个请求持锁 30s，QPS 5W）
  - Redis 单实例：1000W keys 性能 OK
  - 结论：单 Redis 实例足够

续期 QPS：
  - 持锁 10W 个，每个 10s 续期 1 次
  - 续期 QPS = 10W / 10 = 1W QPS
  - 单 Redis 可支撑

主从切换：
  - 切换时间 < 30s（主从同步）
  - 切换期间锁服务不可用
  - 业务必须容忍（短时间不可用）
```
