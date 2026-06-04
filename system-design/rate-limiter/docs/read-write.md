# Read & Write Path

## 限流判断核心流程

```
请求进入
  │
  ▼
[1] 提取 resource + dimensions
  │
  ▼
[2] 匹配规则（内存缓存，O(1)）
  │
  ├── 无规则 ──► 直接放行
  │
  ▼
[3] 白名单检查 ──► 命中则放行
  │
  ▼
[4] 优先级检查 ──► VIP 走独立配额
  │
  ▼
[5] 限流算法判断
  │
  ├── 单机限流 ──► 本地计数器
  │
  └── 分布式限流 ──► Redis / 本地缓存 + Redis
  │
  ▼
[6] 结果返回（allowed + remaining + reset_at）
  │
  ├── 允许 ──► 继续处理业务
  │
  └── 拒绝 ──► 返回 429 / 降级内容
```

## 单机限流判断

### 令牌桶（Token Bucket）

```go
func (b *TokenBucket) Allow(n int64) bool {
    now := time.Now().UnixNano()
    elapsed := now - b.lastRefill
    tokensToAdd := elapsed * b.refillRate / 1e9
    
    b.tokens = min(b.capacity, b.tokens + tokensToAdd)
    b.lastRefill = now
    
    if b.tokens >= n {
        b.tokens -= n
        return true
    }
    return false
}
```

**特点**：允许突发流量，平滑限流，最常用。

### 滑动窗口（Sliding Window）

```go
func (w *SlidingWindow) Allow() bool {
    now := time.Now().Unix()
    currentWindow := now / w.windowSize * w.windowSize
    
    // 清理过期窗口
    w.cleanup(now - w.windowSize)
    
    // 当前窗口计数 + 上一窗口按比例折算
    count := w.counters[currentWindow] + 
             w.counters[currentWindow-w.windowSize] * (1 - float64(now%w.windowSize)/float64(w.windowSize))
    
    if count < w.limit {
        w.counters[currentWindow]++
        return true
    }
    return false
}
```

**特点**：比固定窗口更平滑，避免窗口边界突发。

### 固定窗口（Fixed Window）

```go
func (w *FixedWindow) Allow() bool {
    now := time.Now().Unix()
    currentWindow := now / w.windowSize * w.windowSize
    
    if w.window != currentWindow {
        w.window = currentWindow
        w.count = 0
    }
    
    if w.count < w.limit {
        w.count++
        return true
    }
    return false
}
```

**特点**：实现最简单，但窗口边界有突发问题。

### 漏桶（Leaky Bucket）

以固定速率漏出，请求入桶，桶满则拒绝。

**特点**：强制平滑输出，适合需要严格速率控制的场景（如下游带宽限制）。

## 分布式限流判断

### Redis + Lua（原子操作）

**令牌桶（分布式）**：

```lua
-- ratelimit_token_bucket.lua
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

local elapsed = now - last_refill
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

local allowed = new_tokens >= requested
if allowed then
    new_tokens = new_tokens - requested
end

redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
redis.call('EXPIRE', key, 60)

return {allowed and 1 or 0, math.floor(new_tokens)}
```

**滑动窗口（分布式）**：

```lua
-- ratelimit_sliding_window.lua
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local current = redis.call('ZCARD', key)

if current < limit then
    redis.call('ZADD', key, now, now .. ':' .. ARGV[4])
    redis.call('EXPIRE', key, math.ceil(window / 1000))
    return {1, limit - current - 1}
end

return {0, 0}
```

### 本地缓存 + Redis（降级路径）

```
单机限流判断
  │
  ├── 本地计数未超限 ──► 放行（95% 路径）
  │
  └── 本地计数将超限 ──► 查 Redis 确认
        │
        ├── Redis 可用 ──► 按 Redis 结果判定
        │
        └── Redis 不可用 ──► fail-open（放行）或 fail-close（按本地严格限流）
```

## 规则加载流程

```
配置中心（DB / etcd / Consul）
  │
  ▼ 推送变更 / 定时拉取（5s）
各节点内存缓存
  │
  ▼
规则索引（resource -> []Rule，支持通配匹配）
```

规则变更后，通过 **推送 + 本地定时兜底** 保证最终一致，最多 5s 延迟。
