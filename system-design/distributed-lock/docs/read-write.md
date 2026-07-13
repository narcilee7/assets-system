# Read Write

## 核心设计原则

- **加锁路径**：Redis SET 命令必须用 NX PX 一条原子完成
- **解锁路径**：必须用 Lua 脚本保证"校验 owner + 删除"的原子性
- **续期路径**：续期间隔 TTL/3，续期失败立即放弃
- **可重入路径**：用 Hash 结构记录每个 owner 的重入次数

---

## 1. Redis 分布式锁核心流程

### 1.1 加锁时序图

```
客户端 A                Redis               客户端 B
   │                     │                     │
   │ SET key A NX PX 30s │                     │
   ├────────────────────→│                     │
   │                     │                     │
   │  OK (1)             │                     │
   │←────────────────────┤                     │
   │                     │                     │
   │                     │   SET key B NX PX 30s │
   │                     │←────────────────────┤
   │                     │                     │
   │                     │   nil (没拿到锁)      │
   │                     ├────────────────────→│
   │                     │                     │
   │ 业务执行（10s）       │                     │
   │                     │                     │
   │ 自动续期（每 10s）    │                     │
   │                     │                     │
   │ pexpire key A 30s   │                     │
   ├────────────────────→│                     │
   │  OK (1)             │                     │
   │←────────────────────┤                     │
   │                     │                     │
   │ 业务完成              │                     │
   │                     │                     │
   │ EVAL unlock_script  │                     │
   ├────────────────────→│                     │
   │  OK (1)             │                     │
   │←────────────────────┤                     │
   │                     │                     │
   │                     │  SET key C NX PX 30s │（30s 后）
   │                     │←────────────────────┤
   │                     │                     │
   │                     │   OK (1)            │
   │                     ├────────────────────→│
```

### 1.2 加锁实现（Go + Lua）

```go
// 加锁 Lua 脚本
const acquireScript = `
if redis.call('exists', KEYS[1]) == 0 then
    redis.call('hset', KEYS[1], ARGV[1], 1)
    redis.call('pexpire', KEYS[1], ARGV[2])
    return 1
elseif redis.call('hexists', KEYS[1], ARGV[1]) == 1 then
    redis.call('hincrby', KEYS[1], ARGV[1], 1)
    redis.call('pexpire', KEYS[1], ARGV[2])
    return 1
else
    return 0
end
`

func (l *Lock) Lock(ctx context.Context) error {
    for {
        // 1. 尝试加锁
        result, err := l.redis.Eval(ctx, acquireScript, []string{l.key}, l.owner, l.ttlMs).Result()
        if err != nil {
            return err
        }

        if result.(int64) == 1 {
            // 2. 加锁成功，启动看门狗
            l.startWatchDog(ctx)
            return nil
        }

        // 3. 没拿到锁，等待重试
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(l.retryDelay):
            // 重试
        }
    }
}
```

### 1.3 解锁实现（Lua 原子）

```lua
-- 解锁 Lua 脚本（保证原子性）
if redis.call('hexists', KEYS[1], ARGV[1]) == 0 then
    return nil
else
    local counter = redis.call('hincrby', KEYS[1], ARGV[1], -1)
    if counter == 0 then
        redis.call('del', KEYS[1])
        return 1
    else
        redis.call('pexpire', KEYS[1], ARGV[2])
        return 0
    end
end
```

```go
const releaseScript = `
if redis.call('hexists', KEYS[1], ARGV[1]) == 0 then
    return nil
else
    local counter = redis.call('hincrby', KEYS[1], ARGV[1], -1)
    if counter == 0 then
        redis.call('del', KEYS[1])
        return 1
    else
        redis.call('pexpire', KEYS[1], ARGV[2])
        return 0
    end
end
`

func (l *Lock) Unlock(ctx context.Context) error {
    result, err := l.redis.Eval(ctx, releaseScript, []string{l.key}, l.owner, l.ttlMs).Result()
    if err != nil {
        return err
    }

    // 停止看门狗
    l.stopWatchDog()

    // result == nil 表示锁不存在
    // result == 1 表示完全释放
    // result == 0 表示重入计数减 1 但未完全释放
    _ = result
    return nil
}
```

---

## 2. 看门狗续期实现

### 2.1 看门狗续期 Lua

```lua
-- 续期 Lua 脚本
if redis.call('hexists', KEYS[1], ARGV[1]) == 1 then
    return redis.call('pexpire', KEYS[1], ARGV[2])
else
    return 0
end
```

### 2.2 看门狗 goroutine

```go
func (l *Lock) startWatchDog(ctx context.Context) {
    // 续期间隔 = TTL / 3
    interval := time.Duration(l.ttlMs/3) * time.Millisecond

    l.watchdogStop = make(chan struct{})
    l.watchdogDone = make(chan struct{})

    go func() {
        defer close(l.watchdogDone)

        ticker := time.NewTicker(interval)
        defer ticker.Stop()

        for {
            select {
            case <-ctx.Done():
                return
            case <-l.watchdogStop:
                return
            case <-ticker.C:
                // 续期
                result, err := l.redis.Eval(ctx, renewScript, []string{l.key}, l.owner, l.ttlMs).Result()
                if err != nil {
                    log.Printf("watchdog renew error: %v", err)
                    continue
                }

                if result.(int64) == 0 {
                    // 续期失败：锁已不存在或 owner 不匹配
                    log.Printf("watchdog renew failed: lock lost")
                    l.cancel()
                    return
                }
            }
        }
    }()
}

func (l *Lock) stopWatchDog() {
    if l.watchdogStop != nil {
        close(l.watchdogStop)
        <-l.watchdogDone  // 等待 goroutine 退出
    }
}
```

### 2.3 续期间隔选择

```
TTL = 30s 时：
  - 续期间隔 10s（TTL/3）
  - GC 暂停容忍：3 次续期失败机会

TTL = 10s 时：
  - 续期间隔 3s（TTL/3）
  - 续期开销增加（Redis QPS 升高）

TTL = 60s 时：
  - 续期间隔 20s（TTL/3）
  - 单次续期失败就可能丢锁
  - 不推荐 TTL 过大

经验公式：
  - 续期间隔 = TTL / 3（容忍 2 次失败）
  - 续期间隔 = TTL / 5（更保守，性能开销大）
  - 续期间隔 = TTL / 2（激进，1 次失败就丢锁）

生产推荐：TTL = 30s，续期间隔 = 10s
```

---

## 3. Redisson 源码实现（Java 风格）

### 3.1 RLock.lock()

```java
// Redisson 简化源码
public void lock() {
    lock(-1, null);  // -1 表示永久等待
}

public void lock(long leaseTime, TimeUnit unit) {
    long threadId = Thread.currentThread().getId();
    
    // 1. 尝试加锁
    Long ttl = tryAcquire(leaseTime, unit, threadId);
    
    if (ttl == null) {
        // 2. 加锁成功
        return;
    }
    
    // 3. 加锁失败，订阅锁释放消息
    CompletableFuture<RedissonLockEntry> future = subscribe(threadId);
    RedissonLockEntry entry;
    if (leaseTime == -1) {
        entry = future.get();
    } else {
        entry = future.get(leaseTime, unit);
    }
    
    // 4. 自旋尝试加锁
    try {
        while (true) {
            ttl = tryAcquire(leaseTime, unit, threadId);
            if (ttl == null) {
                break;
            }
            
            // 5. 等待锁释放
            if (ttl >= 0) {
                entry.getLatch().tryAcquire(ttl, TimeUnit.MILLISECONDS);
            } else {
                entry.getLatch().acquire();
            }
        }
    } finally {
        unsubscribe(entry, threadId);
    }
}

private Long tryAcquire(long leaseTime, TimeUnit unit, long threadId) {
    // Lua 脚本：尝试加锁
    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_LONG,
        "if (redis.call('exists', KEYS[1]) == 0) then " +
        "    redis.call('hincrby', KEYS[1], ARGV[2], 1) " +
        "    redis.call('pexpire', KEYS[1], ARGV[1]) " +
        "    return nil " +
        "end " +
        "if (redis.call('hexists', KEYS[1], ARGV[2]) == 1) then " +
        "    redis.call('hincrby', KEYS[1], ARGV[2], 1) " +
        "    redis.call('pexpire', KEYS[1], ARGV[1]) " +
        "    return nil " +
        "end " +
        "return redis.call('pttl', KEYS[1])",
        // KEYS[1] = lock key
        // ARGV[1] = TTL
        // ARGV[2] = owner (UUID:threadId)
        getRawName(), unit.toMillis(leaseTime), getLockName(threadId));
}
```

### 3.2 RLock.unlock()

```java
public void unlock() {
    long threadId = Thread.currentThread().getId();
    
    // Lua 脚本：原子解锁
    Long result = evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_LONG,
        "if (redis.call('exists', KEYS[1]) == 0) then " +
        "    return nil " +
        "end " +
        "if (redis.call('hexists', KEYS[1], ARGV[3]) == 0) then " +
        "    return nil " +
        "end " +
        "local counter = redis.call('hincrby', KEYS[1], ARGV[3], -1) " +
        "if (counter > 0) then " +
        "    redis.call('pexpire', KEYS[1], ARGV[2]) " +
        "    return 0 " +
        "else " +
        "    redis.call('del', KEYS[1]) " +
        "    return 1 " +
        "end",
        getRawName(), internalLockLeaseTime, getLockName(threadId));
    
    if (result == null) {
        throw new IllegalMonitorStateException("attempt to unlock lock, not locked by current thread");
    }
    
    // 取消看门狗
    cancelExpirationRenewal(null);
    
    // 通知等待者
    signal();
}
```

### 3.3 看门狗（Redisson）

```java
// Redisson 看门狗：每 TTL/3 续期一次
private void scheduleExpirationRenewal(long threadId) {
    ExpirationEntry entry = new ExpirationEntry();
    ExpirationEntry oldEntry = EXPIRATION_RENEWAL_MAP
        .putIfAbsent(getEntryName(), entry);
    
    if (oldEntry != null) {
        // 已存在，累加
        oldEntry.addThreadId(threadId);
    } else {
        // 新增，启动续期
        entry.addThreadId(threadId);
        renewExpiration();
    }
}

private void renewExpiration() {
    Timeout task = getServiceManager().newTimeout(new TimerTask() {
        @Override
        public void run(Timeout timeout) {
            ExpirationEntry entry = EXPIRATION_RENEWAL_MAP.get(getEntryName());
            if (entry == null) return;
            
            Long threadId = entry.getFirstThreadId();
            if (threadId == null) return;
            
            // 执行续期 Lua 脚本
            CompletionStage<Boolean> future = evalWriteAsync(
                getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
                "if (redis.call('hexists', KEYS[1], ARGV[2]) == 1) then " +
                "    redis.call('pexpire', KEYS[1], ARGV[1]) " +
                "    return 1 " +
                "end " +
                "return 0",
                getRawName(), internalLockLeaseTime, getLockName(threadId));
            
            future.whenComplete((result, e) -> {
                if (e != null) {
                    // 异常，取消续期
                    EXPIRATION_RENEWAL_MAP.remove(getEntryName());
                    log.error("Can't update lock expiration", e);
                    return;
                }
                
                if (result) {
                    // 续期成功，再次调度
                    renewExpiration();
                } else {
                    // 续期失败（锁不存在），取消
                    cancelExpirationRenewal(null);
                }
            });
        }
    }, internalLockLeaseTime / 3, TimeUnit.MILLISECONDS);  // TTL/3
}
```

---

## 4. 公平锁实现

### 4.1 ZSet 队列

```lua
-- 加锁 Lua（公平）
local key = KEYS[1]
local queue = KEYS[2]
local owner = ARGV[1]
local ttl = ARGV[2]
local now = ARGV[3]

-- 1. 锁空闲 → 直接加锁
if redis.call('exists', key) == 0 then
    redis.call('hset', key, owner, 1)
    redis.call('pexpire', key, ttl)
    redis.call('zrem', queue, owner)
    return 1
end

-- 2. 已是持锁方 → 重入
if redis.call('hexists', key, owner) == 1 then
    redis.call('hincrby', key, owner, 1)
    redis.call('pexpire', key, ttl)
    return 1
end

-- 3. 加入等待队列
redis.call('zadd', queue, now, owner)
return 0
```

### 4.2 解锁 + 通知下一个

```lua
-- 解锁 Lua
local key = KEYS[1]
local queue = KEYS[2]
local owner = ARGV[1]

if redis.call('hexists', key, owner) == 0 then
    return nil
end

local counter = redis.call('hincrby', key, owner, -1)
if counter == 0 then
    redis.call('del', key)
    -- 通知下一个等待者（发布订阅）
    redis.call('publish', 'lock_release:' .. key, owner)
end

redis.call('zrem', queue, owner)
return counter
```

### 4.3 等待者循环

```go
func (l *FairLock) Lock(ctx context.Context) error {
    for {
        // 1. 尝试加锁
        result, err := l.tryAcquire(ctx)
        if err != nil {
            return err
        }
        if result == 1 {
            return nil  // 加锁成功
        }

        // 2. 订阅锁释放通知
        sub := l.redis.Subscribe(ctx, "lock_release:"+l.key)
        defer sub.Close()

        // 3. 等待通知或超时
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(5 * time.Second):
            // 超时重试
        case <-sub.Channel():
            // 锁释放通知，重新尝试
        }
    }
}
```

---

## 5. 读写锁实现

### 5.1 数据结构

```
写锁 key：rwlock:write:{resource_id}
读锁 key：rwlock:read:{resource_id}
读计数 key：rwlock:read_count:{resource_id}  # 记录读锁持有数

写锁状态：
  HSET rwlock:write:user:123 "uuid:thread-1" 1
  TTL 30000

读锁状态：
  HSET rwlock:read:user:123 "uuid:thread-1" 1
  TTL 30000
```

### 5.2 读锁 Lua

```lua
-- 读锁：没有写锁 + 自己是第一个读者 → 加锁成功
local writeKey = KEYS[1]
local readKey = KEYS[2]
local owner = ARGV[1]
local ttl = ARGV[2]

if redis.call('exists', writeKey) == 1 then
    return 0  -- 有写锁，加读锁失败
end

if redis.call('hexists', readKey, owner) == 1 then
    -- 已持有读锁，可重入
    redis.call('hincrby', readKey, owner, 1)
    redis.call('pexpire', readKey, ttl)
    return 1
end

-- 加读锁
redis.call('hset', readKey, owner, 1)
redis.call('pexpire', readKey, ttl)
-- 全局读锁计数 +1
redis.call('incr', 'rwlock:read_count:user:123')
return 1
```

### 5.3 写锁 Lua

```lua
-- 写锁：没有写锁 + 没有读锁 → 加锁成功
local writeKey = KEYS[1]
local readKey = KEYS[2]
local readCountKey = KEYS[3]
local owner = ARGV[1]
local ttl = ARGV[2]

-- 检查写锁
if redis.call('exists', writeKey) == 1 then
    if redis.call('hexists', writeKey, owner) == 1 then
        redis.call('hincrby', writeKey, owner, 1)
        redis.call('pexpire', writeKey, ttl)
        return 1
    end
    return 0
end

-- 检查读锁
if redis.call('exists', readKey) == 1 then
    return 0  -- 有读锁，加写锁失败
end

-- 加写锁
redis.call('hset', writeKey, owner, 1)
redis.call('pexpire', writeKey, ttl)
return 1
```

---

## 6. Redlock 算法（多 Redis 实例）

### 6.1 算法流程

```
Redlock 假设：
  - N 个完全独立的 Redis 实例（建议 N=5）
  - 每个实例没有主从关系
  - 每个实例部署在不同机器/机房

加锁步骤：
  1. 获取当前时间 T1
  2. 依次向 N 个实例发送加锁命令（SET NX PX ttl）
     - 单实例超时时间 = 5s
     - 总超时 = 几秒
  3. 获取当前时间 T2 = T1 + elapsed
  4. 计算获取锁成功的实例数
  5. 成功条件：
     a. 成功数 >= N/2 + 1（多数派）
     b. elapsed < ttl（获取时间未超 TTL）
     c. 至少 majority 成功
  6. 满足 → 加锁成功，锁有效时间 = ttl - elapsed
  7. 不满足 → 加锁失败，向所有实例发送解锁命令
```

### 6.2 Redlock 争议（重要！）

```
Martin Kleppmann 反对意见（2016 年）：

1. 时钟跳跃问题
   - 假设 5 个 Redis 实例的 TTL = 10s
   - 客户端获取锁成功，用了 5s
   - GC 暂停 15s
   - 此时锁已经过期
   - 另一个客户端获取锁成功
   - GC 恢复后，第一个客户端继续执行业务
   - 两个客户端同时持锁

2. fencing token 解决方案
   - 每个锁获取时分配一个单调递增的 token
   - 业务执行前检查 token（资源服务器拒绝旧 token）
   - 但是：分布式锁服务一般不提供 token，需要业务改造

3. 异步模型问题
   - 即使 Redlock 是"安全的"
   - 业务需要考虑"在锁过期前完成业务"
   - 但业务执行时间不确定
   - 只能靠"fencing token + 业务幂等"缓解

Antirez 反驳：
  1. 时钟跳跃是小概率事件
  2. 业务应该用 fencing token（业界标准）
  3. 现实工程中 Redlock 够用

业界共识：
  - Redlock 仍有理论缺陷
  - 大多数场景用单 Redis 实例 + 看门狗
  - 真正强一致用 ZK
  - 不要为了"安全"过度设计
```

---

## 7. ZooKeeper 锁实现

### 7.1 临时顺序节点

```go
// Go + ZK
func (l *ZKLock) Lock(ctx context.Context) error {
    // 1. 创建临时顺序节点
    path, err := l.zk.Create(
        l.parentPath+"/lock_",
        []byte(l.owner),
        zk.FlagEphemeral|zk.FlagSequence,
        zk.WorldACL(zk.PermAll),
    )
    if err != nil {
        return err
    }

    // 2. 获取所有子节点
    children, _, err := l.zk.Children(l.parentPath)
    if err != nil {
        return err
    }

    // 3. 排序子节点
    sort.Strings(children)
    mySeq := strings.TrimPrefix(path, l.parentPath+"/")

    if mySeq == children[0] {
        // 4. 我是最小的 → 加锁成功
        l.heldPath = path
        return nil
    }

    // 5. 监听前一个节点
    prevSeq := children[findIndex(children, mySeq)-1]
    prevPath := l.parentPath + "/" + prevSeq

    exists, _, ch, err := l.zk.ExistsW(prevPath)
    if err != nil {
        return err
    }
    if !exists {
        // 前一个节点已删除，立即尝试
        return l.Lock(ctx)
    }

    // 6. 等待前一个节点删除
    select {
    case <-ctx.Done():
        return ctx.Err()
    case ev := <-ch:
        if ev.Type == zk.EventNodeDeleted {
            return l.Lock(ctx)
        }
        return errors.New("unexpected event")
    }
}
```

### 7.2 ZK 锁特性

```
优势：
  - 强一致（CP）
  - 临时节点自动过期（不用 TTL）
  - Watch 机制支持公平锁

劣势：
  - 写性能差（1W QPS）
  - ZK 集群维护成本
  - 客户端重

适用场景：
  - 金融、支付等强一致场景
  - 频率低但要求严格的资源竞争
  - 已经是 ZK 集群的系统
```

---

## 8. 端到端流程

### 场景：用户下单（库存扣减 + 订单创建）

```java
@Transactional
public Order createOrder(CreateOrderRequest req) {
    // 1. 加库存锁（粒度：SKU）
    String skuLockKey = "inventory:deduct:" + req.getSkuId();
    RLock skuLock = redisson.getLock(skuLockKey);
    
    try {
        if (!skuLock.tryLock(2, 10, TimeUnit.SECONDS)) {
            throw new BusinessException("系统繁忙，请重试");
        }

        try {
            // 2. 扣减库存
            Inventory inv = inventoryRepository.findBySkuId(req.getSkuId());
            if (inv.getStock() < req.getQuantity()) {
                throw new BusinessException("库存不足");
            }
            inv.setStock(inv.getStock() - req.getQuantity());
            inventoryRepository.save(inv);

            // 3. 创建订单
            Order order = new Order();
            order.setId(idGen.gen("order"));
            order.setUserId(req.getUserId());
            order.setSkuId(req.getSkuId());
            order.setQuantity(req.getQuantity());
            order.setStatus(OrderStatus.PENDING);
            orderRepository.save(order);

            return order;

        } finally {
            skuLock.unlock();
        }

    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new BusinessException("系统异常");
    }
}
```

### 关键路径分析

```
1. 加锁（P99 < 5ms）：
   - Redis EVAL Lua
   - 加锁成功 → 启动看门狗（goroutine）

2. 业务执行（P99 < 200ms）：
   - DB 查询库存
   - DB 扣减库存
   - DB 创建订单

3. 解锁（P99 < 5ms）：
   - Redis EVAL Lua
   - 停止看门狗

整链路 P99 < 220ms
```

---

## 9. 锁竞争热点处理

### 9.1 分段锁

```
场景：秒杀 1000 个商品，全局加锁 → 性能差

反例：
  lock:seckill:all  → 所有商品争抢一把锁

正例：分段锁
  lock:seckill:item:sku1
  lock:seckill:item:sku2
  ...
  lock:seckill:item:sku1000

效果：1000 个分段，并发能力提升 1000 倍
```

### 9.2 锁粒度升级

```
策略：从粗到细，按需升级

1. 全局锁（粗）
   - 所有请求竞争一把锁
   - 性能最差

2. 业务锁（中）
   - lock:order:pay:{user_id}（按用户）
   - 同一用户串行，不同用户并行

3. 资源锁（细）
   - lock:inventory:sku:{sku_id}（按商品）
   - 同一商品串行，不同商品并行

4. 操作锁（最细）
   - lock:inventory:deduct:{sku_id}:{version}
   - 用乐观锁版本号减少锁竞争
```

### 9.3 乐观锁替代

```sql
-- 乐观锁：CAS 更新
UPDATE inventory
SET stock = stock - 1, version = version + 1
WHERE sku_id = ? AND stock > 0 AND version = ?;

-- 更新成功 → 扣减成功
-- 更新失败 → 重试或返回
```

**适用场景**：
- 冲突概率低（库存充足）
- 业务可接受重试
- 性能比悲观锁高

**不适用**：
- 冲突概率高（库存紧张）
- 重试代价大
- 必须强一致

---

## 10. 性能特征

| 实现 | 加锁 QPS | 延迟 P99 | 续期 QPS |
|------|---------|---------|---------|
| Redis SETNX | 10W | < 5ms | 1W（10W 锁 / 10s）|
| Redlock（5 实例） | 2W | < 50ms | 2000 |
| ZK 临时节点 | 1W | < 30ms | - |
| DB 唯一约束 | 1K | < 100ms | - |

性能瓶颈：
- Redis 单实例：网络 + Redis 单线程
- Redlock：5 次串行网络调用
- ZK：写操作需要 sync 到 majority
- DB：行锁竞争 + 事务开销
