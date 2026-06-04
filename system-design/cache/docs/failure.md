# Failure Mode

## F1: 缓存穿透（Cache Penetration）

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 恶意请求 | 大量请求不存在的数据（key 不在 DB 也不在缓存） | 所有请求穿透到 DB，DB 被打垮 |
| 业务逻辑 | 查询条件导致无数据，但未缓存 NULL | 每次都查 DB |

### 影响

```
请求 → 查缓存（未命中）→ 查 DB（未命中）→ 返回空
                    ↑ 大量请求走这一路
                    ↓
            DB 被大量空查询打垮
```

### 应对策略

#### 1. 布隆过滤器（Bloom Filter）

```go
type BloomFilter struct {
    redis *redis.Client
}

func (c *BloomFilter) MightContain(key string) bool {
    // 使用 Redis Bloom 模块
    result, _ := c.redis.BFExists("bloom:cache", key).Result()
    return result == 1
}

func (c *Cache) Get(key string) (string, error) {
    // 1. 先查布隆过滤器
    if !c.bloom.MightContain(key) {
        return "", nil  // 一定不存在，直接返回（不查 DB）
    }

    // 2. 查缓存
    val, err := c.redis.Get(key).Result()
    if err == nil {
        return val, nil
    }

    // 3. 查 DB
    val, err = c.db.Query(key)
    if err == sql.ErrNoRows {
        // 数据不存在，记录到布隆过滤器
        c.bloom.Add(key)
        return "", nil
    }

    return val, err
}
```

#### 2. 缓存空值（Cache NULL）

```go
func (c *Cache) Get(key string) (string, error) {
    val, err := c.redis.Get(key).Result()
    if err == nil {
        if val == "NULL" {
            return "", nil  // 之前缓存的空值
        }
        return val, nil
    }

    val, err = c.db.Query(key)
    if err == sql.ErrNoRows {
        // 缓存空值，TTL 短（防止真实数据过期后仍显示空）
        c.redis.Set(key, "NULL", 60*time.Second)
        return "", nil
    }

    return val, err
}
```

---

## F2: 缓存击穿（Cache Breakdown / Hot Key Miss）

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 热点 key 过期 | 热点 key TTL 过期，瞬间大量请求 | 大量请求同时穿透到 DB |
| 缓存重启 | Redis 重启，热点数据丢失 | 大量请求穿透到 DB |

### 影响

```
热点数据缓存过期瞬间
  │
  ├── 请求1 → 查缓存（未命中）→ 查 DB
  ├── 请求2 → 查缓存（未命中）→ 查 DB
  ├── 请求3 → 查缓存（未命中）→ 查 DB
  └── ...（100 个请求同时查 DB）
              ↓
        DB 被同时请求打垮
```

### 应对策略

#### 1. Singleflight（请求合并）

```go
type Cache struct {
    sf *singleflight.Group
}

func (c *Cache) Get(key string) (string, error) {
    val, err, _ := c.sf.Do(key, func() (interface{}, error) {
        val, err := c.redis.Get(key).Result()
        if err == nil {
            return val, nil
        }
        return c.db.Query(key)
    })
    return val.(string), err
}
```

**效果**：100 个请求并发访问同一热点 key，只会有 1 个请求去查 DB，其他 99 个等待。

#### 2. 热点数据不过期 + 异步刷新

```go
// 热点 key 永不过期，但通过版本号控制刷新
func (c *Cache) GetHotKey(key string) (string, error) {
    // 先查本地缓存
    val, ok := c.local.Get(key)
    if ok {
        return val, nil
    }

    // 查 Redis
    val, err := c.redis.Get(key).Result()
    if err == nil {
        c.local.Set(key, val)
        return val, nil
    }

    // 未查到，从 DB 加载
    val, err = c.db.Query(key)
    if err != nil {
        return "", err
    }

    // 写 Redis（但设置 TTL = -1，表示永不过期）
    c.redis.Set(key, val, -1)
    c.local.Set(key, val)

    return val, nil
}

// 版本刷新（后台定时任务）
func (c *Cache) RefreshHotKeys() {
    for {
        // 获取所有热点 key
        hotKeys := c.getHotKeyList()

        for _, key := range hotKeys {
            val, _ := c.db.Query(key)
            c.redis.Set(key, val, -1)
        }

        time.Sleep(5 * time.Minute)
    }
}
```

#### 3. 互斥锁（分布式锁）

```go
func (c *Cache) GetWithLock(key string) (string, error) {
    val, err := c.redis.Get(key).Result()
    if err == nil {
        return val, nil
    }

    // 获取分布式锁
    locked, _ := c.redis.SetNX("lock:"+key, "1", 30*time.Second).Result()
    if !locked {
        // 抢锁失败，等待后重试
        time.Sleep(100 * time.Millisecond)
        return c.GetWithLock(key)
    }
    defer c.redis.Del("lock:" + key)

    // 查 DB
    val, err = c.db.Query(key)
    if err != nil {
        return "", err
    }

    // 回填缓存
    c.redis.Set(key, val, c.defaultTTL)

    return val, nil
}
```

---

## F3: 缓存雪崩（Cache Avalanche）

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 大量 key 同时过期 | 相同 TTL，零点时刻大量过期 | 大量请求穿透到 DB |
| Redis 故障 | Redis 宕机，所有缓存失效 | 所有请求穿透到 DB |
| DB 故障 + 缓存未预热 | 数据库有问题，缓存也已过期 | 系统不可用 |

### 影响

```
时间 T：大量 key 过期
  │
  ├── Key1 过期 → 请求1 查 DB
  ├── Key2 过期 → 请求2 查 DB
  ├── Key3 过期 → 请求3 查 DB
  └── KeyN 过期 → 请求N 查 DB
              ↓
        所有请求同时打 DB
              ↓
        DB 被打垮，系统不可用
```

### 应对策略

#### 1. TTL 加随机 jitter

```go
func (c *Cache) Set(key, value string, baseTTL time.Duration) {
    // 基础 TTL ± 20% 随机 jitter
    jitter := time.Duration(rand.Int63n(int64(baseTTL / 5)))
    ttl := baseTTL + jitter

    c.redis.Set(key, value, ttl)
}
```

#### 2. 服务预热（Warm-up）

```go
// 系统启动时主动加载热点数据
func (c *Cache) WarmUp() {
    hotKeys := c.getHotKeyList()  // 从配置或监控获取热点 key

    for _, key := range hotKeys {
        val, _ := c.db.Query(key)
        c.redis.Set(key, val, c.defaultTTL)
    }
}
```

#### 3. 多级缓存兜底

```
L1（本地缓存）→ L2（Redis）→ L3（MySQL）

即使 Redis 故障，本地缓存还能撑一段时间
```

#### 4. 熔断降级

```
Redis 故障时：
  1. 熔断器打开，暂停访问 Redis
  2. 直接查 MySQL（降低 QPS）
  3. 返回缓存默认值（如返回历史缓存数据）
```

---

## F4: 热 Key 问题（Hot Key Problem）

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 爆款商品 | 双十一秒杀，某商品详情被 10W QPS 访问 | 单 key 打爆 Redis |
| 明星事件 | 热点事件，大量用户访问同一资料 | 单 key 成为热点 |

### 影响

```
热点 key = product:detail:p98765
  │
  ├── 请求1 → Redis Node-1（该 key 所在节点）
  ├── 请求2 → Redis Node-1
  ├── 请求3 → Redis Node-1
  └── 请求N → Redis Node-1
              ↓
        Node-1 CPU 100%
              ↓
        所有请求超时
              ↓
        整个服务不可用
```

### 应对策略

#### 1. 热 key 分散

```go
func (c *Cache) SetHotKey(key, value string, ttl time.Duration) {
    // 写入 10 个随机后缀的 key
    for i := 0; i < 10; i++ {
        hotKey := fmt.Sprintf("%s:%d", key, i)
        c.redis.Set(hotKey, value, ttl)
    }
}

func (c *Cache) GetHotKey(key string) (string, error) {
    // 随机读取一个
    suffix := rand.Intn(10)
    hotKey := fmt.Sprintf("%s:%d", key, suffix)
    return c.redis.Get(hotKey)
}
```

#### 2. Redis Cluster 分片

```
热 key 分散到多个 Redis 节点：
  p98765:0 → Redis-Node-1
  p98765:1 → Redis-Node-2
  p98765:2 → Redis-Node-3
  ...
```

#### 3. 本地缓存兜底

```
热点数据在 Redis 之上加一层本地缓存：
  - 本地缓存命中率 ~30%
  - Redis QPS 降低 70%
  - 即使 Redis 被打爆，本地缓存还能撑住
```

---

## F5: 缓存和数据库不一致

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 读写分离延迟 | 写 DB 主库，读从库，数据还未同步 | 缓存数据和 DB 数据不一致 |
| 更新顺序问题 | 先更新 DB，再更新缓存时失败 | 缓存中是旧数据 |
| 并发更新 | 并发写入导致最终状态不确定 | 数据漂移 |

### 影响

```
用户资料从"张三"改为"李四"
  │
  ├── 步骤1：UPDATE MySQL → "李四"
  ├── 步骤2：SET Redis → "李四"
  │     ↑
  │   这个步骤失败（网络问题）
  │     ↓
  └── Redis 仍是 "张三"
              ↓
        用户看到的仍是旧数据
```

### 应对策略

#### 1. 延迟双删

```go
func (c *Cache) Update(key string, value string) error {
    // 1. 先删缓存
    c.redis.Del(key)

    // 2. 写数据库
    err := c.db.Update(key, value)
    if err != nil {
        return err
    }

    // 3. 延迟 500ms 后再删缓存
    time.Sleep(500 * time.Millisecond)
    c.redis.Del(key)

    return nil
}
```

**原理**：第二次删除确保在 DB 写完后执行，清理掉写操作期间的脏缓存。

#### 2. 订阅 Binlog（最终一致）

```
MySQL → Binlog → Canal → Kafka → Cache Sync → DEL Redis

优点：
  - 完全异步，不影响主流程
  - 不侵入业务代码
  - 最终一致性保证

缺点：
  - 系统复杂度增加
  - 有延迟（通常 ms 级）
```

#### 3. 分布式事务（强一致）

```
如果需要强一致，用分布式事务框架（如 Seata）：

AT 模式：
  1. 开始分布式事务
  2. 写 MySQL（本地事务）
  3. 写 Redis（ TCC 或 AT 模式）
  4. 提交分布式事务

缺点：性能开销大，不适合高并发场景
```

---

## F6: Redis 内存打满

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 大 key 累积 | 缓存数据持续增长，未设置 TTL | Redis OOM |
| RDB/AOF | 持久化 fork 进程消耗内存 | Redis 崩溃 |
| 突发流量 | 缓存热点数据暴增 | Redis 内存不足 |

### 影响

```
Redis 内存：64GB
  │
  ├── 已使用：64GB
  │     ↑
  │   突发写入
  │     ↓
  ├── 尝试写入新 key
  │     ↓
  └── 返回 OOM 错误
              ↓
        部分请求失败
              ↓
        系统不可用
```

### 应对策略

#### 1. 内存监控 + 预警

```prometheus
redis_memory_used_bytes / redis_memory_max_bytes > 0.70  # 预警
redis_memory_used_bytes / redis_memory_max_bytes > 0.85  # 严重
```

#### 2. 淘汰策略配置

```
maxmemory-policy: allkeys-lru

当内存达到 maxmemory 时：
  - allkeys-lru：删除所有 key 中最近最少使用的
  - volatile-lru：只删除设置了 TTL 的 key 中最近最少使用的
  - noeviction：不删除，返回 OOM 错误（不推荐）
```

#### 3. 大 key 拆分

```
原始大 key（Hash）：
  product:catalog:p98765 = {10000 fields, 10MB}

拆分后（按热度）：
  product:catalog:p98765:hot = {100 fields, 100KB}  ← 热点，存 L1
  product:catalog:p98765:cold = {9900 fields, 10MB} ← 冷数据，懒加载
```

---

## F7: Redis 连接池耗尽

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 连接泄漏 | 连接未归还、连接未关闭 | 连接数持续增长 |
| 突发高并发 | QPS 突然暴增 | 连接不够用，请求排队 |
| Redis 故障 | 连接超时，请求堆积 | 大量连接等待 |

### 影响

```
连接池配置：max 100 连接
  │
  ├── 已使用：100（全部借出）
  ├── 新请求：需要连接
  │     ↓
  └── 等待连接（阻塞）
              ↓
        请求超时
              ↓
        系统不可用
```

### 应对策略

#### 1. 连接池合理配置

```go
redis Pool 配置：
  - MaxActive: 100     # 最大连接数
  - MaxIdle: 20       # 最大空闲连接
  - IdleTimeout: 5m   # 空闲连接超时
  - Wait: true        # 连接不够时等待
  - PoolTimeout: 3s   # 等待超时
```

#### 2. 连接泄漏检测

```go
// 定期检查连接池状态
func (c *Cache) MonitorPool() {
    stats := c.redis.PoolStats()
    log.Printf("Pool stats: active=%d, idle=%d, waits=%d",
        stats.Active, stats.Idle, stats.Wait)
}
```

#### 3. 熔断降级

```
Redis 连接耗尽时：
  1. 熔断器打开
  2. 直接查 MySQL（降级）
  3. 延迟减少，等待连接恢复
```

---

## F8: 缓存淘汰导致的数据抖动

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| LRU 误杀 | 热点数据刚访问就被淘汰（内存不足）| 命中率波动大 |
| 淘汰风暴 | 大量 key 同时被淘汰 | 命中率骤降 |
| 内存碎片 | 大量小 key 淘汰后内存碎片化 | 可用内存减少 |

### 影响

```
时间 T：内存达到上限
  │
  ├── Redis 执行 LRU 淘汰
  │     ↓
  ├── 热点数据被淘汰
  │     ↓
  ├── 命中率从 95% 降到 70%
  │     ↓
  └── DB QPS 上升 5x
```

### 应对策略

#### 1. 合理设置 maxmemory

```
建议：maxmemory = 物理内存 * 70%

预留 30% 给：
  - Redis 自身 metadata
  - RDB/AOF 持久化 fork
  - 内存碎片
  - 突发流量缓冲
```

#### 2. 热点数据保护

```
使用 Redis 8.0+ 的热度榜功能：
  - HOTKEYS 命令识别热 key
  - 热 key 自动存入热度榜，避免被淘汰
```

#### 3. 淘汰监控

```prometheus
redis_evicted_keys_total  # 被淘汰的 key 总数
redis_keyspace_hits / (hits + misses)  # 命中率
```
