# Read & Write Path

## 缓存读写主流程

### Cache Aside（标准读写分离）

```
读流程：
  请求 → 查缓存（Redis） → 命中 → 返回
                    ↓ 未命中
                 查数据库（MySQL）
                    ↓
                 写缓存（TTL）
                    ↓
                 返回数据

写流程：
  请求 → 写数据库（MySQL）
              ↓
           删除缓存（DEL）
              ↓
           返回成功
```

---

## Cache Aside 详细实现

### 读操作

```go
func (c *Cache) Get(key string) (string, error) {
    // 1. 先查 Redis
    val, err := c.redis.Get(key).Result()
    if err == nil {
        c.stats.Hits.Add(1)
        return val, nil  // 命中
    }

    if err != redis.Nil {
        return "", err  // Redis 错误
    }

    // 2. Redis 未命中，查 MySQL
    c.stats.Misses.Add(1)
    data, err := c.db.Query(key)
    if err != nil {
        return "", err  // DB 错误
    }

    // 3. 回填 Redis
    if data != nil {
        c.redis.Set(key, data, c.defaultTTL)
    }

    return data, nil
}
```

### 写操作

```go
func (c *Cache) Set(key string, value string, ttl time.Duration) error {
    // 1. 写 MySQL
    err := c.db.Write(key, value)
    if err != nil {
        return err
    }

    // 2. 删除缓存（而非更新）
    // 为什么不更新？
    //   - 更新缓存后，如果 DB 写失败，缓存是脏数据
    //   - 先删缓存，DB 写失败时缓存不会变
    c.redis.Del(key)

    return nil
}
```

**重要**：Cache Aside 写操作是 **DELETE** 而非 **SET**。因为：
1. 删除缓存后，下次访问会自动从 DB 加载最新数据
2. 更新缓存后，如果 DB 写失败，缓存中是旧数据

---

## Write Behind（异步写）详细实现

### 核心思想

```
写请求 → 写入 Redis → 返回成功
              ↓
         放入写队列
              ↓
         后台 Worker 批量处理
              ↓
         批量写入 MySQL
```

### 实现

```go
type WriteBehindCache struct {
    redis    *redis.Client
    queue    chan *WriteRequest
    db       *sql.DB
    batchSize int = 100
    flushInterval time.Duration = 1 * time.Second
}

type WriteRequest struct {
    Key    string
    Value  string
    SQL    string
    Args   []interface{}
}

// 后台批量写入 Worker
func (c *WriteBehindCache) StartWriter() {
    ticker := time.NewTicker(c.flushInterval)
    batch := make([]*WriteRequest, 0, c.batchSize)

    for {
        select {
        case req := <-c.queue:
            batch = append(batch, req)
            if len(batch) >= c.batchSize {
                c.flush(batch)
                batch = batch[:0]
            }
        case <-ticker.C:
            if len(batch) > 0 {
                c.flush(batch)
                batch = batch[:0]
            }
        }
    }
}

func (c *WriteBehindCache) flush(batch []*WriteRequest) {
    // 批量事务提交 MySQL
    tx, _ := c.db.Begin()
    for _, req := range batch {
        tx.Exec(req.SQL, req.Args...)
    }
    tx.Commit()

    log.Printf("WriteBehind: flushed %d items to DB", len(batch))
}
```

### Write Behind 优缺点

```
优点：
  - 写延迟极低（只写 Redis，返回成功）
  - 批量写 DB，效率高（减少 DB 连接开销）
  - 抗突发流量（写队列削峰）

缺点：
  - Redis 故障时可能丢失数据（未持久化到 DB）
  - 实时性差（数据在 Redis 中，DB 可能有延迟）
  - 实现复杂（需要处理 Worker 故障）
  - 需要额外存储 Write Queue
```

---

## 读穿（Read Through）详细实现

### 核心思想

```
读请求 → 缓存未命中
              ↓
         缓存自动加载 DB 数据
              ↓
         返回数据
```

### 实现

```go
func (c *Cache) Get(key string) (string, error) {
    // 1. 先查 Redis
    val, err := c.redis.Get(key).Result()
    if err == nil {
        return val, nil
    }

    // 2. Redis 未命中，缓存自己查 DB（读穿）
    data, err := c.loadFromDB(key)
    if err != nil {
        return "", err
    }

    // 3. 缓存回填
    c.redis.Set(key, data, c.defaultTTL)

    return data, nil
}

func (c *Cache) loadFromDB(key string) (string, error) {
    // 根据 key 解析出 table 和 id
    parts := strings.Split(key, ":")
    table := parts[0]
    id := parts[2]

    // 查询 DB
    row := c.db.QueryRow("SELECT * FROM "+table+" WHERE id = ?", id)
    var data string
    row.Scan(&data)

    return data, nil
}
```

---

## 多级缓存读写（两级缓存）

### 架构

```
┌─────────────────────────────────────────┐
│  L1: Caffeine（进程内）                 │
│      命中率 ~20-30%，延迟 < 1μs         │
├─────────────────────────────────────────┤
│  L2: Redis Cluster                      │
│      命中率 ~60-80%，延迟 0.5-2ms       │
├─────────────────────────────────────────┤
│  L3: MySQL                              │
│      100%（最终数据源）                  │
└─────────────────────────────────────────┘
```

### 实现

```go
type MultiLevelCache struct {
    l1 *LocalCache   // Caffeine
    l2 *RedisCache
    db *DB
}

func (c *MultiLevelCache) Get(key string) (string, error) {
    // 1. 查 L1
    val, ok := c.l1.Get(key)
    if ok {
        return val, nil
    }

    // 2. 查 L2
    val, err := c.l2.Get(key)
    if err == nil {
        c.l1.Set(key, val)  // 回填 L1
        return val, nil
    }

    // 3. L2 未命中，查 DB
    val, err = c.db.Query(key)
    if err != nil {
        return "", err
    }

    // 4. 回填 L1 + L2
    c.l2.Set(key, val)
    c.l1.Set(key, val)

    return val, nil
}

func (c *MultiLevelCache) Set(key, value string) error {
    // 写操作：先写 DB，再删缓存（L1 + L2 都删）
    err := c.db.Write(key, value)
    if err != nil {
        return err
    }

    c.l2.Del(key)
    c.l1.Invalidate(key)  // L1 直接删除

    return nil
}
```

---

## 热点 key 读写（热 key 保护）

### 热点 key 分散

```go
func (c *Cache) GetHotKey(key string) (string, error) {
    // 生成 0-9 随机后缀，分散热点 key
    suffix := rand.Intn(10)
    hotKey := fmt.Sprintf("%s:%d", key, suffix)

    return c.Get(hotKey)
}

func (c *Cache) SetHotKey(key string, value string, ttl time.Duration) error {
    // 写入所有 10 个分散 key
    for i := 0; i < 10; i++ {
        hotKey := fmt.Sprintf("%s:%d", key, i)
        c.Set(hotKey, value, ttl)
    }
    return nil
}
```

### 本地缓存兜底热 key

```go
type HotKeyCache struct {
    // 本地缓存热点数据
    local *caffeine.Cache[string, string]
    redis *RedisCache
}

func (c *HotKeyCache) Get(key string) (string, error) {
    // 1. 先查本地缓存
    val, ok := c.local.Get(key)
    if ok {
        return val, nil
    }

    // 2. 查 Redis
    val, err := c.redis.Get(key)
    if err == nil {
        c.local.Set(key, val)  // 回填本地
    }

    return val, err
}
```

---

## 缓存过期处理

### 惰性过期（Lazy Expiration）

```go
func (c *Cache) Get(key string) (string, error) {
    val, err := c.redis.Get(key).Result()
    if err == nil {
        // 检查是否即将过期（如剩余 < 10% TTL）
        ttl := c.redis.TTL(key).Val()
        if ttl > 0 && ttl < c.defaultTTL/10 {
            // 异步刷新，但返回旧值（不阻塞）
            go func() {
                data, _ := c.db.Query(key)
                c.redis.Set(key, data, c.defaultTTL)
            }()
        }
        return val, nil
    }
    // ...
}
```

### 批量过期扫描

```go
// 每分钟扫描过期 key 并删除
func (c *Cache) CleanupExpiredKeys() {
    ticker := time.NewTicker(1 * time.Minute)
    for range ticker.C {
        // 使用 SCAN 扫描 key
        iter := c.redis.Scan(0, "*", 1000).Iterator()
        for iter.Next() {
            key := iter.Val()
            ttl := c.redis.TTL(key).Val()
            if ttl == -2 {  // -2 表示 key 不存在（已过期但未删除）
                c.redis.Del(key)
                c.stats.Expires.Add(1)
            }
        }
    }
}
```

---

## 缓存预热

### 启动预热

```go
func (c *Cache) WarmUp() error {
    // 1. 加载热点数据到 Redis
    hotKeys := []string{
        "system:config:*",
        "user:profile:*",
        "product:detail:*",
    }

    for _, pattern := range hotKeys {
        keys, _ := c.db.GetKeysByPattern(pattern)
        for _, key := range keys {
            data, _ := c.db.Query(key)
            c.redis.Set(key, data, c.defaultTTL)
        }
    }

    // 2. 加载热点数据到本地缓存
    for _, key := range hotKeys {
        val, _ := c.redis.Get(key)
        if val != "" {
            c.local.Set(key, val)
        }
    }

    log.Printf("Cache warmed up with %d keys", len(hotKeys))
    return nil
}
```

---

## 缓存并发控制

### 缓存击穿保护（singleflight）

```go
// singleflight 保证同一 key 只发起一次 DB 查询
type Cache struct {
    sf *singleflight.Group
    redis *RedisCache
    db *DB
}

func (c *Cache) Get(key string) (string, error) {
    // 调用 singleflight
    val, err, _ := c.sf.Do(key, func() (interface{}, error) {
        // 查缓存
        v, err := c.redis.Get(key)
        if err == nil {
            return v, nil
        }

        // 缓存未命中，查 DB
        v, err = c.db.Query(key)
        if err != nil {
            return "", err
        }

        // 回填缓存
        c.redis.Set(key, v, c.defaultTTL)
        return v, nil
    })

    return val.(string), err
}
```

**作用**：当缓存未命中时，如果有 100 个并发请求同时访问同一个 key，`singleflight` 确保只有 1 个请求去查 DB，其他 99 个等待这个请求的结果。
