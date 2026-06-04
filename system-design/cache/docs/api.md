# API

## 缓存操作 API

### 1. 基础 GET / SET

#### GET（读取）

```http
GET /cache/v1/key/{key}
X-Request-ID: {request_id}
```

响应（命中）：

```json
{
  "key": "user:profile:u12345",
  "value": "{\"user_id\":\"u12345\",\"name\":\"张三\",\"avatar\":\"https://...\"}",
  "ttl_remaining_ms": 234000,
  "hit": true
}
```

响应（未命中）：

```json
{
  "key": "user:profile:u12345",
  "value": null,
  "ttl_remaining_ms": null,
  "hit": false
}
```

#### SET（写入）

```http
POST /cache/v1/key/{key}
Content-Type: application/json

{
  "value": "{\"user_id\":\"u12345\",\"name\":\"张三\"}",
  "ttl_seconds": 3600
}
```

响应：

```json
{
  "key": "user:profile:u12345",
  "success": true,
  "ttl_seconds": 3600
}
```

#### DELETE（删除）

```http
DELETE /cache/v1/key/{key}
```

响应：

```json
{
  "key": "user:profile:u12345",
  "success": true
}
```

---

### 2. 批量操作

#### MGET（批量读取）

```http
POST /cache/v1/key/batch/get
Content-Type: application/json

{
  "keys": [
    "user:profile:u12345",
    "user:profile:u67890",
    "product:detail:p98765"
  ]
}
```

响应：

```json
{
  "results": [
    {"key": "user:profile:u12345", "value": "{...}", "hit": true},
    {"key": "user:profile:u67890", "value": null, "hit": false},
    {"key": "product:detail:p98765", "value": "{...}", "hit": true}
  ],
  "total": 3,
  "hits": 2,
  "misses": 1
}
```

#### MSET（批量写入）

```http
POST /cache/v1/key/batch/set
Content-Type: application/json

{
  "items": [
    {"key": "user:profile:u12345", "value": "{...}", "ttl_seconds": 3600},
    {"key": "user:profile:u67890", "value": "{...}", "ttl_seconds": 3600}
  ],
  "ttl_seconds": 3600
}
```

---

### 3. 缓存模式操作

#### Cache Aside 读（Read）

```
流程：先读缓存，未命中则读数据库并回填缓存

客户端请求：
  GET /cache/v1/key/user:profile:u12345

缓存层处理：
  1. 查 Redis
  2. 命中 → 返回 value + hit=true
  3. 未命中
     a. 查 MySQL（fallback）
     b. 写入 Redis（TTL = 3600s）
     c. 返回 value + hit=false
```

#### Cache Aside 写（Write）

```
流程：先写数据库，再删除缓存（而非更新缓存）

客户端请求：
  PUT /cache/v1/key/user:profile:u12345
  Body: {"value": "{...}"}

处理流程：
  1. 写入 MySQL
  2. 删除 Redis 中的 key（而非 SET）
  3. 返回成功

注意：为什么不直接更新缓存？
  → 更新缓存后，如果 DB 写失败，缓存是脏数据
  → 先删缓存，DB 写失败时缓存不会变
```

#### Write Behind 写（Async Write）

```
流程：写缓存，异步批量写 DB

客户端请求：
  PUT /cache/v1/key/order:status:o123456
  Body: {"value": "paid"}

处理流程：
  1. 立即写入 Redis（返回成功）
  2. 放入写队列（Write Queue）
  3. 后台 Worker 批量从队列取任务
  4. 批量写入 MySQL（每 100 条或每 1s）
  5. 写入失败则重试（最多 3 次）
```

---

### 4. TTL 操作

#### EXPIRE（设置过期时间）

```http
POST /cache/v1/key/{key}/expire
Content-Type: application/json

{
  "ttl_seconds": 7200
}
```

#### TTL（查询剩余时间）

```http
GET /cache/v1/key/{key}/ttl
```

响应：

```json
{
  "key": "user:profile:u12345",
  "ttl_seconds": 2340,
  "exists": true
}
```

#### PERSIST（移除过期时间）

```http
POST /cache/v1/key/{key}/persist
```

---

### 5. 缓存原子操作

#### INCR / DECR（原子计数）

```http
POST /cache/v1/key/{key}/incr
Content-Type: application/json

{
  "delta": 1
}
```

响应：

```json
{
  "key": "product:view_count:p98765",
  "value": 12345,
  "success": true
}
```

#### SETNX（分布式锁实现）

```http
POST /cache/v1/key/{key}/setnx
Content-Type: application/json

{
  "value": "locked",
  "ttl_seconds": 30
}
```

响应：

```json
{
  "key": "lock:order:o123456",
  "success": true,
  "value": "locked"
}
```

**分布式锁实现**：

```go
func AcquireLock(key string, ttl time.Duration) bool {
    // SETNX 原子操作，成功则获得锁
    result := redis.SetNX("lock:"+key, "1", ttl)
    return result == true
}

func ReleaseLock(key string) {
    // 释放锁（Lua 脚本保证原子性）
    redis.Eval(`
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    `, []string{"lock:" + key}, "1")
}
```

---

### 6. Hash 操作

#### HSET / HGET

```http
POST /cache/v1/hash/{key}
Content-Type: application/json

{
  "field": "name",
  "value": "张三"
}
```

```http
GET /cache/v1/hash/{key}/{field}
```

响应：

```json
{
  "key": "user:profile:u12345",
  "field": "name",
  "value": "张三"
}
```

#### HGETALL

```http
GET /cache/v1/hash/{key}
```

响应：

```json
{
  "key": "user:profile:u12345",
  "fields": {
    "user_id": "u12345",
    "name": "张三",
    "avatar": "https://..."
  }
}
```

---

### 7. 缓存管理 API

#### 缓存预热

```http
POST /admin/v1/cache/warm
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "keys": [
    "user:profile:u12345",
    "user:profile:u67890",
    "product:detail:p98765"
  ],
  "ttl_seconds": 3600
}
```

响应：

```json
{
  "warmed": 3,
  "failed": 0,
  "duration_ms": 45
}
```

#### 缓存清理

```http
POST /admin/v1/cache/flush
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "pattern": "user:profile:*",
  "reason": "用户资料大版本升级"
}
```

#### 缓存统计

```http
GET /admin/v1/cache/stats
X-Admin-Token: {admin_token}
```

响应：

```json
{
  "total_keys": 1234567,
  "memory_used_bytes": 5368709120,
  "memory_total_bytes": 17179869184,
  "hit_rate": 0.9523,
  "evicted_count": 12345,
  "ops_per_second": 52345.5
}
```

---

### 8. 缓存模式 API

#### 延迟双删（Delay Double Delete）

用于强一致场景的写操作：

```http
POST /cache/v1/consistency/delay-delete
Content-Type: application/json

{
  "key": "user:profile:u12345",
  "db_write": {
    "table": "users",
    "id": "u12345",
    "data": {"name": "张三"}
  },
  "delay_ms": 500
}
```

处理流程：
```
1. DELETE key from Redis
2. UPDATE MySQL（data）
3. sleep(500ms)
4. DELETE key from Redis（再次删除）
```

---

## Event Contract

| Event | 触发时机 | 消费者 |
|-------|---------|--------|
| `cache.hit` | 缓存命中 | 统计系统、SLO 监控 |
| `cache.miss` | 缓存未命中 | 统计系统、预警 |
| `cache.evict` | 缓存淘汰 | 容量监控、趋势分析 |
| `cache.expire` | 缓存过期 | 容量分析 |
| `cache.write.complete` | 写操作完成（Write Behind 批量写 DB）| 数据一致性监控 |
| `cache.lock.acquired` | 分布式锁获取成功 | 锁监控 |
| `cache.lock.released` | 分布式锁释放 | 锁监控 |
| `cache.error` | 缓存操作异常 | 告警系统 |
