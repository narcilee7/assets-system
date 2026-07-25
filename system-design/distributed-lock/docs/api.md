# API

## 接口总览

分布式锁对外提供三类接口：
1. **加锁接口**（核心）：阻塞 / 非阻塞 / 公平锁 / 读写锁
2. **解锁接口**：原子解锁（含 owner 校验）
3. **状态查询**：锁是否被持有、剩余 TTL、当前 owner

---

## 1. Java SDK 用法（Redisson 风格）

### 1.1 基础加锁

```java
// 1. 初始化 Redisson 客户端
Config config = new Config();
config.useSingleServer()
      .setAddress("redis://10.0.1.10:6379")
      .setPassword("xxx");
RedissonClient redisson = Redisson.create(config);

// 2. 获取锁
RLock lock = redisson.getLock("order:pay:{user_id}");

// 3. 加锁（阻塞，直到拿到或被打断）
lock.lock();
try {
    // 业务逻辑
    processPayment(orderId);
} finally {
    lock.unlock();
}

// 等价于：lock.lock(30, TimeUnit.SECONDS);
// 默认 TTL = 30s，自动启动看门狗
```

### 1.2 tryLock（带超时）

```java
RLock lock = redisson.getLock("order:pay:{user_id}");

// 尝试加锁，最多等 5s，锁持有 10s 后自动释放
boolean ok = lock.tryLock(5, 10, TimeUnit.SECONDS);
if (ok) {
    try {
        processPayment(orderId);
    } finally {
        lock.unlock();
    }
} else {
    // 拿不到锁的处理
    return "系统繁忙，请稍后重试";
}
```

**关键参数**：
- `waitTime`：拿不到锁最多等多久
- `leaseTime`：锁的 TTL（不传则启动看门狗）

### 1.3 公平锁

```java
// 公平锁：按请求顺序获取锁
RFairLock fairLock = redisson.getFairLock("order:pay");
fairLock.lock();
try {
    processOrder();
} finally {
    fairLock.unlock();
}

// 内部用 ZSet + Lua 脚本实现 FIFO
```

### 1.4 读写锁

```java
RReadWriteLock rwLock = redisson.getReadWriteLock("user:profile:{user_id}");
RLock readLock = rwLock.readLock();
RLock writeLock = rwLock.writeLock();

// 读锁：多个客户端可同时持有
readLock.lock();
try {
    UserProfile profile = queryProfile(userId);
} finally {
    readLock.unlock();
}

// 写锁：互斥
writeLock.lock();
try {
    updateProfile(userId, newProfile);
} finally {
    writeLock.unlock();
}
```

### 1.5 信号量

```java
// 限流：最多 10 个并发
RSemaphore semaphore = redisson.getSemaphore("api:rate_limit:{user_id}");
semaphore.trySetPermits(10);  // 设置许可数

if (semaphore.tryAcquire(1, 5, TimeUnit.SECONDS)) {
    try {
        callExternalApi();
    } finally {
        semaphore.release();
    }
} else {
    return "Rate limit exceeded";
}
```

### 1.6 CountDownLatch

```java
RCountDownLatch latch = redisson.getCountDownLatch("batch:task:{batch_id}");
latch.trySetCount(workerCount);

for (int i = 0; i < workerCount; i++) {
    new Thread(() -> {
        doWork();
        latch.countDown();
    }).start();
}

latch.await(30, TimeUnit.SECONDS);  // 等待所有 worker 完成
```

---

## 2. Go SDK 用法

### 2.1 基础加锁

```go
import "github.com/bsm/redislock"

client := redislock.New(redisClient)

lock := client.Obtain("order:pay:12345", &redislock.Options{
    TTL:     30 * time.Second,
    Metadata: "worker-abc",  // owner 标识
})

if err := lock.Lock(ctx); err != nil {
    log.Fatal(err)
}

defer lock.Unlock(ctx)  // 释放锁

// 业务逻辑
processPayment()
```

### 2.2 TryLock

```go
lock := client.Obtain("order:pay:12345", &redislock.Options{
    RetryStrategy: redislock.LimitRetry{
        Max:     5,
        Timeout: 3 * time.Second,  // 最多等 3s
    },
    Metadata: "worker-abc",
})

if err := lock.Lock(ctx); err == redislock.ErrNotObtained {
    // 拿不到锁
    return errors.New("lock not obtained")
} else if err != nil {
    log.Fatal(err)
}
defer lock.Unlock(ctx)
```

### 2.3 续期（手动）

```go
// bsm/redislock 不带看门狗，需要手动续期
ctx, cancel := context.WithCancel(context.Background())
defer cancel()

// 启动续期 goroutine
go func() {
    ticker := time.NewTicker(10 * time.Second)  // TTL/3
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            if err := lock.Refresh(ctx, 30*time.Second, nil); err != nil {
                log.Printf("lock refresh failed: %v", err)
                cancel()  // 续期失败，主动放弃
            }
        }
    }
}()

processPayment()
```

---

## 3. Python SDK 用法

```python
from redis import Redis
from redis.lock import Lock

# Redis 内置的 Lock 实现
r = Redis(host='10.0.1.10', port=6379)
lock = r.lock('order:pay:12345', timeout=30, thread_local=False)

if lock.acquire(blocking=True, blocking_timeout=5):
    try:
        process_payment(order_id)
    finally:
        lock.release()
else:
    return "系统繁忙"
```

---

## 4. 底层 HTTP API（如果自行实现服务）

### 4.1 加锁

```http
POST /lock/v1/acquire
Content-Type: application/json
X-Auth-Token: {jwt}

{
  "key": "order:pay:12345",
  "owner": "worker-abc-uuid",
  "ttl_ms": 30000,
  "wait_timeout_ms": 5000,
  "is_reentrant": true
}

# 成功
HTTP/1.1 200 OK
{
  "acquired": true,
  "lock_id": "lock-uuid-xxx",
  "owner": "worker-abc-uuid",
  "acquired_at": 1704067201000,
  "expires_at": 1704067231000
}

# 拿不到锁
HTTP/1.1 200 OK
{
  "acquired": false,
  "current_owner": "worker-xyz-uuid",
  "remaining_ttl_ms": 12000,
  "reason": "lock held by another client"
}
```

### 4.2 解锁

```http
POST /lock/v1/release
Content-Type: application/json

{
  "key": "order:pay:12345",
  "owner": "worker-abc-uuid",
  "lock_id": "lock-uuid-xxx"
}

# 成功
HTTP/1.1 200 OK
{
  "released": true
}

# owner 不匹配
HTTP/1.1 409 Conflict
{
  "released": false,
  "reason": "owner mismatch",
  "current_owner": "worker-xyz-uuid"
}
```

### 4.3 续期

```http
POST /lock/v1/refresh
Content-Type: application/json

{
  "key": "order:pay:12345",
  "owner": "worker-abc-uuid",
  "ttl_ms": 30000
}

HTTP/1.1 200 OK
{
  "refreshed": true,
  "expires_at": 1704067261000
}
```

### 4.4 查询锁状态

```http
GET /lock/v1/status?key=order:pay:12345

HTTP/1.1 200 OK
{
  "key": "order:pay:12345",
  "held": true,
  "owner": "worker-abc-uuid",
  "remaining_ttl_ms": 18500,
  "wait_count": 3,        # 当前等待的客户端数（公平锁）
  "reentrant_count": 2    # 重入次数（如果有）
}
```

---

## 5. 错误码

| 错误码 | HTTP | 含义 | 处理建议 |
|--------|------|------|---------|
| `OK` | 200 | 加锁成功 | - |
| `NOT_OBTAINED` | 200 (acquired=false) | 拿不到锁 | 重试或返回 |
| `TIMEOUT` | 408 | 等待超时 | 重试或返回 |
| `INTERRUPTED` | 409 | 加锁被打断 | 业务处理 |
| `OWNER_MISMATCH` | 409 | 解锁时 owner 不匹配 | 检查 owner |
| `LOCK_NOT_FOUND` | 404 | 锁不存在（可能已过期） | 不需要解锁 |
| `RENEWAL_FAILED` | 503 | 续期失败 | 主动放弃，报警 |
| `INTERNAL_ERROR` | 500 | 服务器错误 | 看日志 |

---

## 6. 完整调用示例

### 场景：用户支付（防重复扣款）

```java
@Service
public class PaymentService {

    @Autowired
    private RedissonClient redisson;

    public PaymentResult pay(Order order) {
        // 锁粒度：每个订单一把锁
        String lockKey = "order:pay:" + order.getId();
        RLock lock = redisson.getLock(lockKey);

        try {
            // 最多等 3s，锁 TTL 30s（自动续期）
            boolean ok = lock.tryLock(3, 30, TimeUnit.SECONDS);
            if (!ok) {
                return PaymentResult.busy();
            }

            try {
                // 1. 查询订单状态（防重入幂等）
                Order existing = orderRepository.findById(order.getId());
                if (existing.getStatus() == OrderStatus.PAID) {
                    return PaymentResult.duplicate();
                }

                // 2. 调用支付网关
                PaymentResult result = paymentGateway.charge(order);

                // 3. 更新订单状态
                existing.setStatus(OrderStatus.PAID);
                orderRepository.save(existing);

                return result;

            } finally {
                lock.unlock();
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return PaymentResult.interrupted();
        }
    }
}
```

### 场景：库存扣减（防止超卖）

```java
@Service
public class InventoryService {

    @Autowired
    private RedissonClient redisson;

    public boolean deductStock(String skuId, int quantity) {
        // 锁粒度：每个 SKU 一把锁
        String lockKey = "inventory:sku:" + skuId;
        RLock lock = redisson.getLock(lockKey);

        try {
            if (!lock.tryLock(1, 5, TimeUnit.SECONDS)) {
                return false;
            }

            try {
                Inventory inv = inventoryRepository.findBySkuId(skuId);
                if (inv.getStock() < quantity) {
                    return false;  // 库存不足
                }
                inv.setStock(inv.getStock() - quantity);
                inventoryRepository.save(inv);
                return true;

            } finally {
                lock.unlock();
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
```

### 场景：分布式定时任务（防重复执行）

```java
@Scheduled(cron = "0 0 2 * * ?")  // 每天凌晨 2 点
public void dailyReportJob() {
    String lockKey = "scheduled:daily_report:" + LocalDate.now();
    RLock lock = redisson.getLock(lockKey);

    try {
        // 等 0s（不阻塞），锁 TTL 1h（覆盖任务最长执行时间）
        if (!lock.tryLock(0, 3600, TimeUnit.SECONDS)) {
            log.info("Daily report job already running on another instance");
            return;
        }

        try {
            generateDailyReport();
        } finally {
            lock.unlock();
        }

    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
}
```

---

## 7. 锁粒度设计原则

```
原则 1：锁粒度尽量小
  - 反例：用全局锁 "global:lock"，所有业务串行
  - 正例：用业务粒度锁 "order:pay:{order_id}"

原则 2：避免热点锁
  - 反例：秒杀 1000 个商品用同一把锁
  - 正例：用分段锁 "seckill:item:{item_id}:{bucket}"

原则 3：避免锁内做大事
  - 反例：锁内调用外部 HTTP，可能阻塞 10s+
  - 正例：锁内只做"原子操作"，其他操作放锁外

原则 4：锁 key 要带业务前缀
  - 反例：key="lock"，所有业务都争抢
  - 正例：key="business:scene:resource_id"
```

---

## 8. Redisson 与自研对比

```
Redisson（推荐）：
  + 完整的锁生态（lock / fairLock / readWriteLock / semaphore / countDownLatch）
  + 内置看门狗
  + 多语言支持（Java/Go/Python）
  - 客户端较重（依赖较多）

自研：
  + 灵活定制
  + 轻量
  - 需要自己实现所有功能
  - 看门狗、续期、可重入都要手写

生产推荐：
  - Java：Redisson（几乎所有公司都用）
  - Go：bsm/redislock 或自研
  - Python：redis-py 自带 Lock
```
