# Problem

## 需求

构建一个生产级的分布式锁，能够在分布式环境下保证**互斥、可重入、超时可控、自动续期、公平可选**，并解决锁误删、Redlock 争议、脑裂、主从切换丢锁等工程问题。

### 功能需求

#### 1. 互斥性（最核心）

- **同一时刻只有一个客户端持有锁**：业务 A 加锁后，业务 B 不能加同一把锁
- **跨进程、跨机器、跨数据中心**：不能依赖单机状态（内存、文件）
- **锁状态可感知**：其他客户端能正确判断锁是否被持有

#### 2. 可重入

- **同一线程可多次加锁**：避免死锁（递归调用场景）
- **重入计数**：每次加锁 +1，解锁 -1，归零时真正释放
- **跨线程不可重入**：业务 A 线程加的锁，业务 A 另一个线程不能再加（除非显式传 owner）

#### 3. 超时可控

- **锁 TTL**：锁必须有有效期，防止持锁方崩溃后永远不释放
- **锁等待超时**：客户端拿不到锁时，最多等多久
- **业务超时保护**：业务执行超过 TTL，需要主动续期

#### 4. 自动续期（看门狗 / Watchdog）

- **后台心跳**：持锁期间，定期（TTL/3）续期锁
- **续期失败处理**：续期失败时主动放弃锁，避免业务与锁状态不一致
- **业务完成自动停止续期**：unlock 时取消续期任务

#### 5. 公平性（可选）

- **FIFO 队列**：先到先得，避免饥饿
- **非公平默认**：先抢到的先得，性能更好
- **按 owner 哈希**：保证同一 owner 串行执行

#### 6. 阻塞 vs 非阻塞

- **非阻塞（tryLock）**：拿不到锁立即返回 false
- **阻塞（lock）**：拿不到锁等待，直到拿到或超时
- **阻塞 + 中断**：等待时可被外部信号打断

---

### 非功能需求

| 指标 | 目标 | 说明 |
|------|------|------|
| 加锁成功率 | > 99.9% | 锁服务正常时几乎 100% |
| 加锁延迟（P99） | < 10ms | Redis 实现 < 5ms |
| 续期成功率 | > 99.99% | 看门狗续期 |
| 解锁原子性 | 100% | 必须用 Lua 脚本保证 |
| 可用性 | 99.99% | 单 Redis 实例够用，主从更佳 |
| 持锁容量 | ≥ 100W | Redis 单实例可支撑 |
| 公平性 | 可选 | 默认非公平 |

---

### 约束

- **CAP 权衡**：分布式锁必须在 C（一致性）和 A（可用性）之间选
  - Redis 单实例：AP（高可用，但主从切换可能丢锁）
  - ZK：CP（强一致，但写性能差）
  - DB：CP（强一致，但写性能最差）
- **不能完全避免锁失效**：网络分区、节点故障都可能让锁失效，业务必须容忍
- **不能跨语言透明**：每种语言（Java/Go/Python）的实现略有差异
- **不能假设时钟同步**：续期间隔只能靠本地时间估算

---

### 关键设计决策

#### 决策 1：Redis vs ZK vs DB

| 维度 | Redis SETNX | Redlock | ZooKeeper | DB (MySQL) |
|------|-------------|---------|-----------|------------|
| 一致性 | AP | 弱 AP | CP | CP |
| 性能 | 极高（10W QPS） | 中（5W QPS） | 低（1W QPS） | 低（1K QPS） |
| 实现复杂度 | 低 | 高 | 中 | 中 |
| 锁失效风险 | 主从切换丢锁 | 仍可能丢 | 几乎不丢 | 几乎不丢 |
| 适用场景 | 互联网高并发 | 极少使用 | 中等并发 + 强一致 | 极少使用 |
| 看门狗 | 客户端实现 | 客户端实现 | 临时节点自动过期 | 客户端实现 |

**选型建议**：
- **互联网 90% 场景**：Redis SETNX + 看门狗（Redisson 风格）
- **金融/支付等强一致场景**：ZK 或 DB（即使性能差）
- **不要用 Redlock**：Martin Kleppmann 指出 Redlock 仍有安全性问题（详见 failure.md）

#### 决策 2：Redis SETNX 锁实现

```go
// 加锁（原子操作）
SET lock_key {owner_id} NX PX {ttl_ms}

// owner_id 唯一：UUID + 线程 ID，用于解锁时校验
// NX：只设置不存在的 key（原子互斥）
// PX：设置过期时间（毫秒）
// TTL：避免持锁方崩溃后锁永远不释放
```

**关键设计点**：
1. **必须用 SET 命令**：老版本用 SETNX + EXPIRE 是两步，非原子，可能在 SETNX 后崩溃导致死锁
2. **owner_id 必须唯一**：解锁时校验，防止误删别人的锁
3. **TTL 必须设置**：兜底，防止崩溃死锁
4. **解锁必须用 Lua 脚本**：保证"校验 + 删除"的原子性

```lua
-- 解锁 Lua 脚本（保证原子性）
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

#### 决策 3：续期策略（看门狗）

```
TTL = 30s（默认）
续期间隔 = TTL / 3 = 10s

续期流程：
  1. 后台 goroutine 每 10s 执行一次 Lua 脚本
  2. Lua 脚本：if get(key) == owner_id then expire(key, 30s)
  3. 续期成功 → 继续持锁
  4. 续期失败（key 不存在或 owner 不对）→ 主动放弃，报警

为什么是 TTL/3？
  - 太短（如 TTL/10 = 3s）：续期开销大，Redis 压力大
  - 太长（如 TTL/1.5）：单次续期失败就可能锁失效
  - TTL/3 是经验值：给续期 3 次失败机会
```

#### 决策 4：可重入实现

```go
// Redisson 可重入思路（Java）
public class RedissonLock {
    private final ConcurrentMap<Thread, LockEntry> holdCount;  // 线程 → 重入计数
    
    public void lock() {
        // 1. 检查当前线程是否已持有锁
        LockEntry entry = holdCount.get(Thread.currentThread());
        if (entry != null) {
            entry.count++;
            return;  // 已持有，重入 +1
        }
        
        // 2. 首次加锁
        boolean ok = redis.set(key, owner, NX, PX, ttl);
        if (ok) {
            holdCount.put(Thread.currentThread(), new LockEntry(1));
            startWatchDog();
        }
    }
    
    public void unlock() {
        LockEntry entry = holdCount.get(Thread.currentThread());
        if (entry == null) throw new IllegalMonitorStateException();
        
        entry.count--;
        if (entry.count == 0) {
            // 重入计数归零，真正解锁
            redis.eval(unlockScript, key, owner);
            holdCount.remove(Thread.currentThread());
            stopWatchDog();
        }
    }
}
```

---

### 真实案例与踩坑

#### 案例 1：订单支付锁失效导致重复扣款

某电商系统的"用户支付订单"接口用 Redis SETNX 加锁，TTL=5s。但用户支付链路涉及 6 个服务调用（风控、库存、扣款、积分、加券、消息），正常耗时 2-3s，大促期间 GC 抖动时可能到 6s。

某次大促期间：
- 用户支付 → 加锁成功
- GC 暂停 4s
- 锁 TTL 过期（5s）
- 第二个支付请求进来 → 加锁成功
- 两个请求同时执行扣款
- 用户被扣两次款

**教训**：
- TTL 必须 > 业务最长执行时间
- 必须有看门狗续期（不能用固定 TTL 硬扛）
- 业务必须有幂等保护（即使锁失效，也不能重复扣款）

#### 案例 2：Redisson 看门狗没正确停止导致锁泄漏

某系统使用 Redisson，但业务方法 try-catch 后忘记 unlock：
- 业务异常 → unlock 没调用 → 看门狗仍在续期
- 锁永远不释放
- 其他客户端永远拿不到锁
- 整个业务流程瘫痪

**教训**：
- try-finally 模式：`finally { lock.unlock(); }`
- 看门狗在 unlock 时停止续期（但如果是 try-catch 路径，要确保 unlock 一定执行）
- 用 Redisson 的 tryLock(timeout) + 自动释放（不需要看门狗）

#### 案例 3：Redis 主从切换导致锁失效

Redis Sentinel 主从架构下：
- 主节点写入 SET key value NX PX 30000 → 成功
- 主节点还没来得及同步给从节点
- 主节点宕机，从节点升级为主
- 新主节点没有这个 key
- 第二个客户端加锁成功
- 两个客户端同时持有"同一把锁"

**教训**：
- Redis 主从架构天然不适合分布式锁（有同步延迟）
- 强一致场景用 ZK 或 DB
- 业务必须有幂等保护，不能完全依赖锁

#### 案例 4：解锁时 owner 校验失败导致锁泄漏

某 Go 实现：
```go
// 错误：直接删除，不校验 owner
func Unlock(key string) {
    redis.Del(key)
}
```

场景：
- 客户端 A 加锁成功（key=lock, value=A）
- 客户端 A 业务执行很慢，TTL 过期
- 客户端 B 加锁成功（key=lock, value=B）
- 客户端 A 执行完，调用 Unlock → 删除 key=lock
- 客户端 B 的锁被 A 误删
- 客户端 C 加锁成功
- B 和 C 同时持有锁

**教训**：
- 解锁必须校验 owner（用 Lua 脚本）
- owner 必须唯一（UUID）
- 否则就是"伪锁"

#### 案例 5：Martin Kleppmann vs Antirez 关于 Redlock 的争论

Martin Kleppmann（剑桥大学，分布式系统专家）在 2016 年发表《How to do distributed locking》，指出 Redlock 算法存在严重安全性问题。

Antirez（Redis 作者）发文反驳。

争论焦点：
- Kleppmann：Redlock 依赖时钟假设，时钟跳跃（NTP 调整、运维操作）会导致锁失效
- Antirez：时钟跳跃是小概率事件，可以通过 fencing token 缓解

**行业共识**：
- Redlock 仍有理论缺陷
- 大多数互联网场景用 Redis 单实例 SETNX + 业务幂等
- 不要为了"绝对安全"上 ZK，性能损失太大
- 强一致场景（金融）才必须用 ZK
