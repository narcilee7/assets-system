# Redis 工程化

## 1. 核心数据结构

```
Redis 数据结构与适用场景

String
├── 缓存、计数器、分布式锁
├── 命令：SET、GET、INCR、DECR、SETEX
├── 内部：SDS（Simple Dynamic String）
└── 示例：SET user:1:token "abc123" EX 3600

Hash
├── 对象存储、用户信息
├── 命令：HSET、HGET、HGETALL、HMSET
├── 内部：ziplist / hashtable
└── 示例：HSET user:1 name "Alice" age 25

List
├── 队列、栈、时间线
├── 命令：LPUSH、RPUSH、LPOP、RPOP、LRANGE
├── 内部：quicklist（ziplist + 双向链表）
└── 示例：LPUSH feed:user:1 "post:100"

Set
├── 去重、标签、共同好友
├── 命令：SADD、SREM、SISMEMBER、SINTER、SUNION
├── 内部：intset / hashtable
└── 示例：SADD tags:post:1 "redis" "database"

Sorted Set（ZSet）
├── 排行榜、延迟队列、范围查询
├── 命令：ZADD、ZRANGE、ZREVRANGE、ZREMRANGEBYSCORE
├── 内部：skiplist + hashtable
└── 示例：ZADD leaderboard 100 "player:1"

Bitmap
├── 签到、在线状态、布隆过滤器
├── 命令：SETBIT、GETBIT、BITCOUNT、BITOP
└── 示例：SETBIT user:online 1001 1

HyperLogLog
├── UV 统计（基数估计）
├── 命令：PFADD、PFCOUNT、PFMERGE
└── 误差 ~0.81%，固定 12KB

Stream
├── 消息队列（Kafka 简化版）
├── 命令：XADD、XREAD、XGROUP、XACK
└── 示例：XADD orders * user_id 1 amount 99.99

Geospatial
├── 地理位置、附近的人
├── 命令：GEOADD、GEORADIUS、GEODIST
└── 内部：Sorted Set + geohash
```

## 2. 持久化

```
RDB（快照）
├── 原理：fork 子进程，生成内存快照
├── 配置：save 900 1（900秒内有1次变更则保存）
├── 优点：恢复快、文件紧凑
├── 缺点：可能丢数据（两次快照之间）
└── 适用：备份、灾难恢复

AOF（追加日志）
├── 原理：记录每个写命令
├── 配置：appendonly yes，appendfsync everysec
├── 重写：定期压缩 AOF 文件（bgrewriteaof）
├── 优点：数据安全（最多丢1秒）
├── 缺点：文件大、恢复慢
└── 适用：数据安全要求高

混合持久化（Redis 4.0+）
├── AOF 开头是 RDB 格式，后面是 AOF
├── 兼顾恢复速度和数据安全
└── 推荐：生产环境开启
```

```conf
# redis.conf
save 900 1
save 300 10
save 60 10000

appendonly yes
appendfsync everysec
aof-use-rdb-preamble yes

auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

## 3. 高可用架构

```
主从复制（Replication）
├── 一主多从
├── 从库异步复制
├── 读写分离（读走从库）
├── 缺点：手动故障转移

Sentinel（哨兵）
├── 监控主从状态
├── 自动故障转移
├── 通知客户端新主库
├── 最小：3 个 Sentinel 节点
└── 适用：中小规模

Cluster（集群）
├── 数据分片（16384 个 slot）
├── 去中心化
├── 自动故障转移
├── 支持水平扩展
└── 适用：大规模

架构对比
          主从               Sentinel            Cluster
  ┌─────────┐            ┌─────────┐          ┌─────────┐
  │  Master │◄───────────│  Master │◄─────────│ Node A  │──┐
  │         │            │         │          │ (slots) │  │
  └────┬────┘            └────┬────┘          └─────────┘  │
       │                      │              ┌─────────┐    │ Gossip
  ┌────┴────┐            ┌────┴────┐        │ Node B  │◄───┘
  │  Slave  │            │  Slave  │        │ (slots) │
  │  Slave  │            │ Sentinel│        └─────────┘
  └─────────┘            │ Sentinel│           ...
                         │ Sentinel│
                         └─────────┘
```

## 4. 缓存模式

```
Cache-Aside（旁路缓存，最常用）
├── 读：先查缓存，miss 则查 DB 写回缓存
├── 写：先写 DB，再删缓存（非更新缓存）
├── 优点：简单、缓存和 DB 无强耦合
└── 缺点：可能有短暂不一致

Read-Through
├── 读：应用只读缓存，缓存 miss 时自己加载 DB
├── 写：应用写 DB，缓存由 DB 通知更新
├── 优点：应用逻辑简单
└── 缺点：需要缓存库支持

Write-Through
├── 写：同时写缓存和 DB
├── 读：只读缓存
├── 优点：一致性最好
└── 缺点：写延迟高

Write-Behind（Write-Back）
├── 写：只写缓存，异步批量写 DB
├── 优点：写性能极高
└── 缺点：可能丢数据
```

```
缓存问题与解决方案

缓存穿透（Cache Penetration）
├── 查询不存在的数据，每次都打到 DB
├── 解决：布隆过滤器、缓存空值

缓存击穿（Cache Breakdown）
├── 热点 key 过期，大量请求打到 DB
├── 解决：互斥锁（只有一个线程重建缓存）、逻辑过期（不设置 TTL）

缓存雪崩（Cache Avalanche）
├── 大量 key 同时过期
├── 解决：随机 TTL、多级缓存、熔断降级

缓存一致性
├── 强一致：Write-Through + 分布式事务（性能差）
├── 最终一致：Cache-Aside + 延迟双删 + 消息队列
└── 原则：能接受短暂不一致就用 Cache-Aside
```

```python
# 延迟双删（Cache-Aside 最终一致）
def update_data(key, value):
    # 1. 删缓存
    redis.delete(key)
    # 2. 写数据库
    db.update(key, value)
    # 3. 延迟再删（防止脏读导致旧数据回填）
    time.sleep(0.5)
    redis.delete(key)

# 互斥锁防止缓存击穿
import threading

lock = threading.Lock()

def get_data(key):
    data = redis.get(key)
    if data:
        return data

    # 尝试获取锁
    if lock.acquire(blocking=False):
        try:
            # 双重检查
            data = redis.get(key)
            if data:
                return data
            # 从 DB 加载
            data = db.query(key)
            redis.setex(key, 3600, data)
            return data
        finally:
            lock.release()
    else:
        # 等待后重试
        time.sleep(0.1)
        return get_data(key)
```
