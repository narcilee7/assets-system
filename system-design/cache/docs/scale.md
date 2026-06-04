# Scale

## 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 缓存命中率 | > 95% | 读请求命中缓存 |
| 本地缓存命中率 | > 30% | L1 命中率 |
| Redis QPS | < 50W | 单节点峰值 |
| P99 延迟 | < 1ms | 本地缓存命中 |
| P99 延迟 | < 2ms | Redis 命中 |
| 内存利用率 | < 70% | 预留 30% 缓冲 |
| 淘汰速率 | < 1000/s | 正常运行时 |

---

## 性能瓶颈分析

### 瓶颈 1：Redis 单节点 QPS 上限

#### 问题

Redis 单节点吞吐量上限约 10-50W QPS（取决于硬件和数据大小）。如果业务 QPS > 50W，Redis 会成为瓶颈。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **Redis Cluster** | 数据分片到多个节点 | QPS 线性扩展（2 节点 = 2x）|
| **本地缓存** | Caffeine 缓存热点数据 | Redis QPS 降低 70% |
| **Pipeline** | 批量执行命令 | RTT 从 N×2 降到 2 |
| **Lua 脚本** | 合并多个操作为一个原子操作 | RTT 降低，减少网络往返 |

#### Redis Cluster 分片

```
Client
  │
  ├── Hash Key → slot_1 → Redis-Node-1
  ├── Hash Key → slot_2 → Redis-Node-2
  └── Hash Key → slot_3 → Redis-Node-3

分片键选择：
  - 按业务 ID 分片（用户 ID、订单 ID）
  - 避免大 key 和热点 key 在同一分片
```

---

### 瓶颈 2：热 Key 集中

#### 问题

20% 的 key 产生 80% 的流量。如果热 key 在单节点，该节点 CPU 被打满。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **热 key 分散** | key 后缀加 0-9 随机数 | 单 key QPS 降低 10x |
| **本地缓存兜底** | 热 key 在进程内存中 | Redis QPS 降低 70% |
| **多级缓存** | L1 本地 + L2 Redis | 综合命中率提升到 95%+ |

#### 热 key 分散实现

```go
// 写入：分散到 10 个 key
func (c *Cache) SetHotKey(key, value string, ttl time.Duration) {
    for i := 0; i < 10; i++ {
        hotKey := fmt.Sprintf("%s:%d", key, i)
        c.redis.Set(hotKey, value, ttl)
    }
}

// 读取：随机选一个
func (c *Cache) GetHotKey(key string) (string, error) {
    suffix := rand.Intn(10)
    hotKey := fmt.Sprintf("%s:%d", key, suffix)
    return c.redis.Get(hotKey)
}
```

---

### 瓶颈 3：大 Key 访问延迟

#### 问题

单个 key > 10MB（String 类型）或元素数量 > 10W（Hash/List/Set/ZSet），访问延迟高，且消耗大量内存。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **大 key 拆分** | Hash 按热度拆分为 hot/cold | 小 key 访问快 10x |
| **压缩 value** | 使用 gzip 压缩大 value | 内存降低 70% |
| **增量获取** | 使用 HSCAN 分批获取 | 避免大 key 阻塞 |

#### 大 Hash 拆分

```
原始（10MB）：
  product:catalog:p98765 = {10000 fields}

拆分后：
  product:catalog:p98765:hot = {100 fields, 100KB}   ← 热点字段
  product:catalog:p98765:cold = {9900 fields, 10MB}  ← 冷数据
```

---

### 瓶颈 4：缓存击穿（并发查 DB）

#### 问题

热点 key 过期瞬间，大量并发请求同时穿透到 DB。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **Singleflight** | 请求合并，同一 key 只查一次 DB | DB QPS 降低 90% |
| **热点永不过期** | TTL=-1，异步刷新 | 无击穿 |
| **分布式锁** | 只有一个请求查 DB | 并发控制 |

#### Singleflight 实现

```go
type Cache struct {
    sf *singleflight.Group
}

func (c *Cache) Get(key string) (string, error) {
    val, err, _ := c.sf.Do(key, func() (interface{}, error) {
        // 只有第一个请求执行这个函数
        return c.getFromRedis(key)
    })
    return val.(string), err
}
```

---

### 瓶颈 5：内存容量规划

#### 问题

缓存数据持续增长，如果内存不足，会触发 OOM 或大量淘汰。

#### 容量估算公式

```
缓存容量 = key 数量 × 平均 value 大小 × 安全系数

假设：
  - key 数量：100W
  - 平均 value：1KB
  - 安全系数：0.7

所需内存 = 100W × 1KB / 0.7 = 1.4GB

Redis 配置：
  - maxmemory = 2GB
  - maxmemory-policy = allkeys-lru
  - 当使用量 > 70% 预警
```

#### Key 生命周期管理

```
短期数据（TTL < 1h）：用户会话、验证码
中期数据（TTL 1-24h）：商品详情、用户资料
长期数据（TTL > 24h）：系统配置、排行榜

定期清理策略：
  - 热点 key：设置较长 TTL，人工刷新
  - 冷数据：设置较短 TTL，自动过期
  - 临时数据：必须设置 TTL
```

---

## 扩展方案

### 扩展维度 1：Redis Cluster 水平扩展

```
单节点 → 多节点分片

3 主 3 从配置：
  Redis-Node-1 (master) → Redis-Node-1 (slave)
  Redis-Node-2 (master) → Redis-Node-2 (slave)
  Redis-Node-3 (master) → Redis-Node-3 (slave)

容量扩展：
  - 从 3 节点扩到 6 节点
  - 数据重新分片（resharding）
  - 使用 slot 迁移，线上不停服
```

### 扩展维度 2：多级缓存架构

```
┌─────────────────────────────────────────┐
│  L1: 本地缓存（Caffeine）                │
│      命中率 20-30%，延迟 < 1μs           │
│      容量：进程内存                      │
├─────────────────────────────────────────┤
│  L2: Redis Cluster                      │
│      命中率 60-80%，延迟 0.5-2ms         │
│      容量：Redis 集群总内存               │
├─────────────────────────────────────────┤
│  L3: MySQL                              │
│      命中率 100%，延迟 5-20ms             │
│      容量：磁盘空间                      │
└─────────────────────────────────────────┘
```

### 扩展维度 3：跨地域缓存同步

```
Region CN（北京）
  └── Redis-1（主）

Region SG（新加坡）
  └── Redis-2（从）

同步方式：
  - Redis Replication（同步复制，延迟低）
  - Redis Cluster Proxy（如 Codis）
  - 应用层按地域路由（用户读就近缓存）
```

---

## 容量规划

### QPS 容量估算

```
目标 QPS = 50W

Redis 单节点 QPS = 10W
所需节点数 = 50W / 10W = 5 节点

考虑冗余（2 个故障节点容灾）：
  实际配置 = 5 + 2 = 7 节点（3 主 4 从）
```

### 内存容量估算

```
业务数据：
  - 用户资料：100W × 1KB = 1GB
  - 商品详情：50W × 2KB = 1GB
  - 订单概要：200W × 0.5KB = 1GB

缓存热点比例：30%
  实际缓存 = 3GB × 30% = 1GB

安全水位：70%
  配置内存 = 1GB / 0.7 = 1.5GB

Redis 内存配置：maxmemory 2GB
```

### 吞吐量估算

```
场景：商品详情页
  - 页面打开 QPS：100W
  - 缓存命中率：95%
  - Redis QPS：(100W × 5%) = 5W（符合）

场景：用户资料更新
  - 更新 QPS：1W
  - 写操作延迟：P99 < 10ms
```

---

## 监控指标

### 核心指标

```prometheus
# 命中率
cache_hit_total{layer="l1"} 1234567890
cache_miss_total{layer="l1"} 123456789
cache_hit_rate{layer="l1"} 0.909
cache_hit_rate{layer="l2"} 0.852
cache_hit_rate{overall"} 0.952

# 内存
redis_memory_used_bytes 5368709120
redis_memory_max_bytes 17179869184
redis_memory_usage_ratio 0.312

# 淘汰
redis_evicted_keys_total 12345
redis_expired_keys_total 67890

# 操作
redis_ops_per_second 52345.5
redis_keyspace_hits 1234567890
redis_keyspace_misses 123456789

# 连接
redis_connected_clients 125
redis_blocked_clients 0

# 命令耗时
redis_command_duration_seconds{cmd="GET", quantile="0.99"} 0.000234
redis_command_duration_seconds{cmd="SET", quantile="0.99"} 0.000456
```

### 告警阈值

| 指标 | 警告 | 严重 |
|------|------|------|
| 命中率 | < 90% | < 80% |
| 内存使用率 | > 70% | > 85% |
| 淘汰 key 数 | > 1000/s | > 5000/s |
| Redis QPS | > 80% 容量 | > 95% 容量 |
| 延迟 P99 | > 5ms | > 20ms |
| 连接数 | > 80% 最大连接 | > 95% 最大连接 |
| 单个 key 大小 | > 10MB | > 50MB |
