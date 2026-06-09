# 缓存策略

## 1. 缓存模式

```
Cache-Aside（旁路缓存）—— 最常用
  ├── 读：先查缓存 → miss 则查 DB → 写入缓存
  ├── 写：先写 DB → 删除缓存（非更新）
  └── 优点：简单、缓存与 DB 解耦
  
Read-Through（读穿透）
  ├── 读：应用只查缓存，缓存 miss 时自动从 DB 加载
  ├── 写：应用只写缓存，缓存同步写 DB
  └── 优点：应用逻辑简单
  └── 缺点：缓存层复杂

Write-Through（写穿透）
  ├── 写：同时写缓存和 DB
  ├── 读：只读缓存
  └── 优点：强一致性
  └── 缺点：写延迟高

Write-Behind（写回）
  ├── 写：只写缓存，异步批量写 DB
  ├── 读：只读缓存
  └── 优点：写性能极高
  └── 缺点：可能丢数据
```

```python
# Cache-Aside 实现
class CacheAside:
    def __init__(self, cache, db):
        self.cache = cache
        self.db = db
        self.ttl = 300

    def get(self, key):
        value = self.cache.get(key)
        if value is not None:
            return value
        
        value = self.db.query(key)
        if value:
            self.cache.setex(key, self.ttl, value)
        return value

    def set(self, key, value):
        self.db.update(key, value)
        self.cache.delete(key)  # 删除而非更新，避免并发写不一致

    def delete(self, key):
        self.db.delete(key)
        self.cache.delete(key)
```

## 2. Redis 深度

```bash
# 数据类型与使用场景

# String：计数器、缓存、分布式锁
SET user:1:name "Alice" EX 300
INCR page:view:homepage
SETNX lock:order:123 "owner-id" EX 30  # 分布式锁

# Hash：对象存储
HSET user:1 name "Alice" age 30 city "Beijing"
HGETALL user:1

# List：队列、时间线
LPUSH timeline:user:1 "post:100"
LRANGE timeline:user:1 0 20
BLPOP queue:tasks 30  # 阻塞消费

# Set：标签、共同关注
SADD user:1:tags "tech" "python"
SINTER user:1:tags user:2:tags  # 共同标签

# Sorted Set：排行榜、延迟队列
ZADD leaderboard 1000 "player:1"
ZREVRANGE leaderboard 0 9 WITHSCORES
ZADD delay:queue 1720000000 "task:1"  # 时间戳作为 score

# Bitmap：用户签到、在线状态
SETBIT signin:2024-06 1001 1
BITCOUNT signin:2024-06

# HyperLogLog：UV 统计
PFADD uv:2024-06-01 "user:1"
PFCOUNT uv:2024-06-01

# Geo：地理位置
GEOADD restaurants 116.4 39.9 "restaurant:1"
GEORADIUS restaurants 116.4 39.9 5 km WITHDIST

# Stream：消息队列（Kafka-like）
XADD orders * product_id 100 quantity 2
XREAD BLOCK 5000 STREAMS orders $
XGROUP CREATE orders consumer-group $
```

```bash
# Redis 持久化

# RDB（快照）
SAVE                    # 同步保存（阻塞）
BGSAVE                  # 后台保存
# 配置：save 900 1 / save 300 10 / save 60 10000
# 优点：紧凑、恢复快、适合备份
# 缺点：可能丢数据（两次快照间）

# AOF（追加日志）
# 配置：appendonly yes, appendfsync everysec
# 优点：数据更安全、可重建
# 缺点：文件大、恢复慢

# 混合持久化（Redis 4.0+）
# AOF 文件包含 RDB 前缀 + AOF 增量
# 兼顾恢复速度和数据安全
```

```bash
# Redis 高可用

# 主从复制
REPLICAOF 192.168.1.10 6379
# 优点：读写分离、数据冗余
# 缺点：手动故障转移

# Sentinel（哨兵）
# 监控、自动故障转移、通知
# 最小部署：3 个 Sentinel 节点

# Cluster（集群）
# 数据分片（16384 个 slot）
# 自动故障转移、水平扩展
# redis-cli --cluster create node1:6379 node2:6379 node3:6379 --cluster-replicas 1
```

## 3. 缓存问题与解决

```
缓存穿透（Cache Penetration）
  ├── 现象：查询不存在的数据，每次都穿透到 DB
  ├── 解决：
  │   ├── 布隆过滤器（Bloom Filter）预判
  │   ├── 缓存空值（NULL Object）
  │   └── 参数校验 + 限流

缓存击穿（Cache Breakdown）
  ├── 现象：热点 key 过期，瞬间大量请求打到 DB
  ├── 解决：
  │   ├── 互斥锁（SETNX）只允许一个线程重建
  │   ├── 逻辑过期（永不过期，后台异步更新）
  │   └── 热点 key 预加载

缓存雪崩（Cache Avalanche）
  ├── 现象：大量 key 同时过期，DB 压力激增
  ├── 解决：
  │   ├── 过期时间加随机偏移
  │   ├── 多级缓存（L1/L2）
  │   ├── 熔断降级
  │   └── 缓存预热
```

```python
# 互斥锁防止缓存击穿
import threading
import redis

class CacheMutex:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.local_locks = {}
    
    def get_with_lock(self, key, loader, ttl=300):
        # 1. 查缓存
        value = self.redis.get(key)
        if value:
            return json.loads(value)
        
        # 2. 尝试获取分布式锁
        lock_key = f"lock:{key}"
        lock_value = str(uuid.uuid4())
        
        # SET key value NX EX seconds
        acquired = self.redis.set(lock_key, lock_value, nx=True, ex=30)
        
        if acquired:
            try:
                # 双重检查
                value = self.redis.get(key)
                if value:
                    return json.loads(value)
                
                # 从 DB 加载
                value = loader()
                self.redis.setex(key, ttl, json.dumps(value))
                return value
            finally:
                # 释放锁（Lua 保证原子性）
                lua = """
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
                """
                self.redis.eval(lua, 1, lock_key, lock_value)
        else:
            # 未获取锁，短暂等待后重试
            time.sleep(0.1)
            return self.get_with_lock(key, loader, ttl)
```

## 4. 多级缓存架构

```
多级缓存架构

用户请求
  ↓
L1: 本地缓存（Caffeine/Guava）—— 1ms
  ├── 进程内，无网络开销
  ├── 容量小（MB 级）
  └── TTL 短（秒级）
  ↓ miss
L2: 分布式缓存（Redis Cluster）—— 1-5ms
  ├── 跨进程共享
  ├── 容量中（GB 级）
  └── TTL 中（分钟级）
  ↓ miss
L3: 数据库（MySQL/PostgreSQL）—— 5-50ms
  └── 持久化存储

写入路径：
  写 DB → 删 L2 → 删 L1（或通过消息通知删 L1）
```

```java
// Caffeine 本地缓存 + Redis 分布式缓存

LoadingCache<String, User> localCache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(10, TimeUnit.SECONDS)
    .refreshAfterWrite(5, TimeUnit.SECONDS)
    .build(key -> {
        // L1 miss，查 L2
        String json = redisTemplate.opsForValue().get(key);
        if (json != null) {
            return objectMapper.readValue(json, User.class);
        }
        // L2 miss，查 DB
        User user = userRepository.findById(key)
            .orElseThrow(() -> new NotFoundException(key));
        // 回填 L2
        redisTemplate.opsForValue().set(key, 
            objectMapper.writeValueAsString(user), 5, TimeUnit.MINUTES);
        return user;
    });

// 缓存更新
@CacheEvict(value = "users", key = "#user.id")
@Transactional
public void updateUser(User user) {
    userRepository.save(user);
    // 删除 L2
    redisTemplate.delete("user:" + user.getId());
    // 广播删除 L1（通过 Redis Pub/Sub 或 MQ）
    redisTemplate.convertAndSend("cache:invalidate", 
        "user:" + user.getId());
}
```
