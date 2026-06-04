// Package local 提供单机限流算法实现
package local

import (
	"context"
	"sync/atomic"
	"time"
)

// TokenBucket 单机令牌桶
type TokenBucket struct {
	tokens     atomic.Int64 // 当前令牌数
	lastRefill atomic.Int64 // 上次填充时间戳（纳秒）
	capacity   int64        // 桶容量
	refillRate int64        // 每秒填充令牌数
}

// NewTokenBucket 创建令牌桶
// capacity: 桶容量
// refillRate: 每秒填充令牌数
func NewTokenBucket(capacity, refillRate int64) *TokenBucket {
	tb := &TokenBucket{
		capacity:   capacity,
		refillRate: refillRate,
	}
	tb.tokens.Store(capacity)
	tb.lastRefill.Store(time.Now().UnixNano())
	return tb
}

// Allow 请求 n 个令牌
func (tb *TokenBucket) Allow(n int64) bool {
	now := time.Now().UnixNano()
	last := tb.lastRefill.Load()

	// 尝试更新 lastRefill（CAS）
	if now > last {
		elapsed := now - last
		tokensToAdd := elapsed * tb.refillRate / 1_000_000_000
		current := tb.tokens.Load()
		newTokens := min(tb.capacity, current+tokensToAdd)

		if tb.lastRefill.CompareAndSwap(last, now) {
			tb.tokens.Store(newTokens)
		}
	}

	for {
		current := tb.tokens.Load()
		if current < n {
			return false
		}
		if tb.tokens.CompareAndSwap(current, current-n) {
			return true
		}
	}
}

// Status 返回当前状态
func (tb *TokenBucket) Status() (remaining int64, resetAt int64) {
	now := time.Now().UnixNano()
	last := tb.lastRefill.Load()
	elapsed := now - last
	tokensToAdd := elapsed * tb.refillRate / 1_000_000_000
	current := min(tb.capacity, tb.tokens.Load()+tokensToAdd)

	if tb.refillRate > 0 {
		missing := tb.capacity - current
		waitNs := missing * 1_000_000_000 / tb.refillRate
		resetAt = now + waitNs
	}
	return current, resetAt
}

// TokenBucketLimiter 适配统一接口
type TokenBucketLimiter struct {
	bucket *TokenBucket
	limit  int64
}

func NewTokenBucketLimiter(capacity, refillRate int64) *TokenBucketLimiter {
	return &TokenBucketLimiter{
		bucket: NewTokenBucket(capacity, refillRate),
		limit:  capacity,
	}
}

func (l *TokenBucketLimiter) Allow(ctx context.Context) (bool, int64, int64) {
	ok := l.bucket.Allow(1)
	remaining, resetAt := l.bucket.Status()
	return ok, remaining, resetAt
}

func (l *TokenBucketLimiter) Limit() int64 { return l.limit }

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
