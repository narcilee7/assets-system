// Package redis 提供基于 Redis 的分布式限流实现
package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// TokenBucket Redis 分布式令牌桶
type TokenBucket struct {
	client   redis.UniversalClient
	script   *redis.Script
	capacity int64
	rate     int64 // 每秒填充速率
}

// tokenBucketLua Redis 令牌桶 Lua 脚本
const tokenBucketLua = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

local elapsed = math.max(0, now - last_refill)
local new_tokens = math.min(capacity, tokens + elapsed * rate / 1000000000)

local allowed = 0
if new_tokens >= requested then
    new_tokens = new_tokens - requested
    allowed = 1
end

redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
redis.call('EXPIRE', key, ttl)

return {allowed, math.floor(new_tokens)}
`

// Capacity 返回桶容量
func (tb *TokenBucket) Capacity() int64 { return tb.capacity }

// NewTokenBucket 创建 Redis 令牌桶
func NewTokenBucket(client redis.UniversalClient, capacity, rate int64) *TokenBucket {
	return &TokenBucket{
		client:   client,
		script:   redis.NewScript(tokenBucketLua),
		capacity: capacity,
		rate:     rate,
	}
}

// Allow 请求令牌
func (tb *TokenBucket) Allow(ctx context.Context, key string, n int64) (bool, int64, error) {
	now := time.Now().UnixNano()
	ttl := 60 // key 过期时间 60 秒

	result, err := tb.script.Run(ctx, tb.client, []string{key},
		tb.capacity,
		tb.rate,
		now,
		n,
		ttl,
	).Result()
	if err != nil {
		return false, 0, fmt.Errorf("redis eval failed: %w", err)
	}

	vals := result.([]interface{})
	allowed := vals[0].(int64) == 1
	remaining := vals[1].(int64)
	return allowed, remaining, nil
}

// SlidingWindow Redis 分布式滑动窗口
type SlidingWindow struct {
	client     redis.UniversalClient
	script     *redis.Script
	limit      int64
	windowSize time.Duration
}

const slidingWindowLua = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]
local ttl = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local current = redis.call('ZCARD', key)

if current < limit then
    redis.call('ZADD', key, now, member)
    redis.call('EXPIRE', key, ttl)
    return {1, limit - current - 1}
end

return {0, 0}
`

// Limit 返回窗口限制
func (w *SlidingWindow) Limit() int64 { return w.limit }

// NewSlidingWindow 创建 Redis 滑动窗口
func NewSlidingWindow(client redis.UniversalClient, limit int64, windowSize time.Duration) *SlidingWindow {
	return &SlidingWindow{
		client:     client,
		script:     redis.NewScript(slidingWindowLua),
		limit:      limit,
		windowSize: windowSize,
	}
}

// Allow 判断是否允许通过
func (w *SlidingWindow) Allow(ctx context.Context, key string) (bool, int64, error) {
	now := time.Now().UnixMilli()
	member := fmt.Sprintf("%d:%s", now, key) // 保证唯一性
	ttl := int(w.windowSize.Seconds()) + 1

	result, err := w.script.Run(ctx, w.client, []string{key},
		int64(w.windowSize.Milliseconds()),
		w.limit,
		now,
		member,
		ttl,
	).Result()
	if err != nil {
		return false, 0, fmt.Errorf("redis eval failed: %w", err)
	}

	vals := result.([]interface{})
	allowed := vals[0].(int64) == 1
	remaining := vals[1].(int64)
	return allowed, remaining, nil
}
