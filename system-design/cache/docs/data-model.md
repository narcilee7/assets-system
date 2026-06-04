# Data Model

## 核心设计原则

- **缓存无状态**：缓存是 DB 的加速层，不是数据源
- **内存效率优先**：key 简短，value 精简（只缓存必要字段）
- **TTL 必设**：除热点数据外，所有 key 必须设置 TTL
- **冷热分离**：热点数据在本地缓存，冷数据在 Redis

---

## 1. 缓存 key 命名规范

### 命名结构

```
{业务模块}:{实体类型}:{标识字段}:{版本/用途}

各部分说明：
  - 业务模块：user / product / order / system
  - 实体类型：profile / detail / summary / config
  - 标识字段：唯一标识（ID 或关键词）
  - 版本/用途：v1 / v2 / hot / cold（可选）
```

### 命名示例

| 场景 | Key 示例 | 说明 |
|------|----------|------|
| 用户资料 | `user:profile:u12345:v2` | 用户 ID + 版本号 |
| 商品详情 | `product:detail:p98765` | 商品 ID |
| 订单概要 | `order:summary:o123456` | 订单 ID |
| 热点商品 | `product:detail:p98765:hot` | 热点标记 |
| 会话数据 | `session:sess-abc123` | Session ID |
| 系统配置 | `system:config:rate_limit` | 配置 key |
| 分布式锁 | `lock:order:o123456` | 锁 key |
| 计数 | `product:view_count:p98765` | 计数器 |
| 验证码 | `captcha:img:code123` | 验证码 |

---

## 2. Redis 数据结构选择

### String（字符串）

```
场景：存储序列化后的 JSON、简单值
大小：单个 value < 10MB
操作：GET / SET / INCR / DECR

示例：
  user:profile:u12345 = "{\"name\":\"张三\",\"age\":30}"
  product:view_count:p98765 = "12345"
```

### Hash（哈希表）

```
场景：存储实体对象的多个字段（避免重复序列化整个对象）
大小：field 数量 < 100，value 总大小 < 10MB
操作：HGET / HSET / HGETALL

示例：
  user:profile:u12345 = {
    "user_id": "u12345",
    "name": "张三",
    "avatar": "https://...",
    "created_at": "2024-01-01"
  }
```

### List（列表）

```
场景：最新消息列表、最新评论列表
大小：列表长度 < 10000
操作：LPUSH / LRANGE / LTRIM

示例：
  user:notifications:u12345 = [
    "msg1", "msg2", "msg3", ...
  ]
```

### Set（集合）

```
场景：用户标签、在线用户集合
大小：集合大小 < 10W
操作：SADD / SMEMBERS / SISMEMBER

示例：
  user:tags:u12345 = {"vip", "active", "verified"}
```

### Sorted Set（有序集合）

```
场景：排行榜、热销榜、延时队列
大小：集合大小 < 10W
操作：ZADD / ZREVRANGE / ZSCORE

示例：
  product:rank:sales:daily = {
    p98765: 1000,
    p98766: 950,
    p98767: 900
  }
```

### Stream（流）

```
场景：消息队列、事件流
大小：消费者数量 < 10
操作：XADD / XREAD / XGROUP

示例：
  user:actions:stream = {
    "event1": {"type": "click", "product": "p98765"},
    "event2": {"type": "buy", "product": "p98765"}
  }
```

---

## 3. 多级缓存数据结构

### L1 本地缓存（Caffeine / Guava Cache）

```go
type LocalCache struct {
    // Caffeine 实现
    cache *caffeine.Cache[string, string]

    // 配置
    maxSize       int64  = 10000    // 最大条目数
    expireAfterAccess time.Duration = 5 * time.Minute
    refreshAfterWrite time.Duration = 10 * time.Minute
}

func NewLocalCache() *LocalCache {
    cache := caffeine.NewBuilder[string, string]().
        MaximumSize(10000).
        ExpireAfterAccess(5 * time.Minute).
        // 异步刷新，避免缓存击穿
        RefreshAfterWrite(10 * time.Minute).
        Build()
    return &LocalCache{cache: cache}
}
```

### L2 分布式缓存（Redis）

```
Redis Key Pattern：
  user:profile:u12345
    ├── value: {"name": "张三", "avatar": "..."}
    ├── ttl: 3600s
    └── memory: ~500 bytes
```

### L1 + L2 组合

```
查询流程：
  1. 查 L1 Caffeine（进程内）
  │    命中 → 返回（< 1μs）
  │    未命中
  ▼
  2. 查 L2 Redis
  │    命中 → 返回 + 回填 L1
  │    未命中
  ▼
  3. 查 L3 MySQL
       返回 + 回填 L1 + L2
```

---

## 4. 缓存淘汰策略数据结构

### LRU（Least Recently Used）

```go
// 基于 LinkedHashMap 的 LRU 实现
type LRUCache struct {
    maxSize int
    cache   *list.List // 双向链表，最新访问的在头部
    items   map[string]*list.Element
}

func (c *LRUCache) Get(key string) (string, bool) {
    if elem, ok := c.items[key]; ok {
        // 移动到头部（更新访问顺序）
        c.cache.MoveToFront(elem)
        return elem.Value.(string), true
    }
    return "", false
}

func (c *LRUCache) Put(key, value string) {
    if elem, ok := c.items[key]; ok {
        // 更新并移动到头部
        c.cache.MoveToFront(elem)
        elem.Value = value
        return
    }

    // 新增到头部
    elem := c.cache.PushFront(&Item{Key: key, Value: value})
    c.items[key] = elem

    // 超容量则淘汰尾部
    if c.cache.Len() > c.maxSize {
        oldest := c.cache.Back()
        c.cache.Remove(oldest)
        delete(c.items, oldest.Value.(*Item).Key)
    }
}
```

### LFU（Least Frequently Used）

```go
type LFUCache struct {
    minFreq  int
    capacity int
    cache    map[string]*Node      // key → node
    freqList map[int]*FreqList     // freq → freq list
}

type Node struct {
    Key    string
    Value  string
    Freq   int
    Prev   *Node
    Next   *Node
}
```

### TTL 管理

```
Redis TTL 实现：
  - 每个 key 关联一个 EXPIRE 时间戳
  - Redis 定期清理过期 key（主动 + 惰性）

惰性清理：
  - GET 时检查 key 是否过期
  - 过期则返回 nil，并删除 key
  - 优点：只检查被访问的 key
  - 缺点：过期 key 可能长期占用内存

主动清理：
  - Redis 每 100ms 随机扫描一定数量 key
  - 删除其中过期的 key
  - 优点：及时清理过期 key
  - 缺点：消耗 CPU

内存紧张时主动清理：
  - Redis 内存达到 maxmemory 时触发淘汰
  - 根据 maxmemory-policy 策略淘汰
```

---

## 5. 缓存一致性数据结构

### Binlog 订阅模式

```
当使用订阅 DB Binlog 保持一致时：

MySQL Binlog
  │
  ▼
Canal / Debezium 订阅
  │
  ▼
消息队列（Kafka）
  │
  ▼
Cache Sync Worker
  │
  ▼
删除 / 更新 Redis Cache

关键数据结构：
  BinlogEvent {
    table: "users"
    action: "UPDATE"
    primary_key: "u12345"
    before: {name: "张三"}
    after: {name: "李四"}
    timestamp: 1704067200
  }
```

### 延迟双删模式

```
Write（延迟双删）流程：

Step 1: DELETE Redis Key
  DEL user:profile:u12345

Step 2: UPDATE MySQL
  UPDATE users SET name='李四' WHERE id='u12345'

Step 3: SLEEP(500ms)

Step 4: DELETE Redis Key（再次删除）
  DEL user:profile:u12345
```

---

## 6. 热点 key 分散

### 热点 key 加上随机后缀

```
原始 key（热点）：
  product:detail:p98765  ← 10W QPS

分散后（不热点）：
  product:detail:p98765:0  ← 1W QPS
  product:detail:p98765:1  ← 1W QPS
  ...
  product:detail:p98765:9  ← 1W QPS

读取时：
  1. 生成 0-9 随机数
  2. 查 product:detail:p98765:{random}
  3. 写入时写所有 10 个 key

注意：这种方式会导致 TTL 不统一，需在 value 中包含版本号
```

---

## 7. 分布式锁数据结构

### Redis 分布式锁

```
Lock Key:
  lock:order:o123456
    value: "node-01:thread-123:1704067200"
    ttl: 30s

使用 Lua 脚本保证原子性：

-- 获取锁
if redis.call("setnx", KEYS[1], ARGV[1]) == 1 then
    redis.call("expire", KEYS[1], ARGV[2])
    return 1
else
    return 0
end

-- 释放锁（只释放自己持有的锁）
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

### RedLock 算法

```
场景：单 Redis 不够安全，需要多节点分布式锁

算法：
  1. 获取 N 个独立的 Redis 节点（通常 N=5）
  2. 在所有节点上用相同 key 和随机 value 获取锁
  3. 计算获取锁花费的时间，如果 >= TTL/2 则失败
  4. 获取成功 >= N/2+1 个节点才认为成功
  5. 释放锁时在所有节点上执行 Lua 脚本释放

可靠性：
  - 需要 >= 3 个节点才能保证
  - 容忍最多 N/2 个节点故障
```

---

## 8. 缓存统计数据结构

### 命中率统计

```go
type CacheStats struct {
    Hits     atomic.Int64  // 命中数
    Misses   atomic.Int64  // 未命中数
    Evictions atomic.Int64 // 淘汰数
    Expires  atomic.Int64  // 过期数
}

func (s *CacheStats) HitRate() float64 {
    total := s.Hits.Load() + s.Misses.Load()
    if total == 0 {
        return 0
    }
    return float64(s.Hits.Load()) / float64(total)
}
```

### Redis INFO 关键指标

```
# Memory
used_memory: 5368709120              # 已使用内存（bytes）
used_memory_peak: 6442450944        # 峰值内存
maxmemory: 17179869184               # 最大内存
maxmemory_policy: allkeys-lru        # 淘汰策略

# Stats
keyspace_hits: 1234567890            # 命中数
keyspace_misses: 56789012            # 未命中数
evicted_keys: 12345                  # 淘汰 key 数
expired_keys: 67890                  # 过期 key 数

# Stats
instantaneous_ops_per_second: 52345  # QPS
```

---

## 9. 大 key 识别

### SCAN + MEMORY USAGE

```
Redis 大 key 定义：
  - String 类型：value > 10MB
  - Hash/List/Set/ZSet：元素数量 > 10W 或内存 > 10MB

识别脚本（Redis 5.0+）：
  redis-cli --bigkeys

输出示例：
  Biggest string found: 'user:sessions:*' 10MB
  Biggest hash   found: 'product:catalog' has 50000 fields (5MB)
  Biggest list   found: 'user:notifications:*' has 10000 items (2MB)
  Biggest zset   found: 'product:rank:*' has 100000 items (8MB)
```

### 实时监控大 key

```go
// 使用 Redis MONITOR 采样分析大 key
func MonitorBigKeys(client *redis.Client, threshold int64) {
    ctx := context.Background()
    scanner := client.Scan(ctx, 0, "*", 1000).Iterator()

    for scanner.Next(ctx) {
        key := scanner.Val()
        size, err := redis.ObjectMemoryUsage(ctx, client, key).Result()
        if err != nil {
            continue
        }
        if size > threshold {
            log.Printf("Big key: %s, size: %d bytes", key, size)
        }
    }
}
```
