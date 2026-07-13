package ratelimit

import (
	"context"
	"errors"
	"sync"
	"time"
)

// Limiter 限流器接口，小接口表达依赖
type Limiter interface {
	// Allow 尝试获取 1 个令牌，立即返回是否成功
	Allow() bool
	// AllowN 尝试获取 n 个令牌
	AllowN(n int) bool
	// Wait 阻塞等待直到获取 1 个令牌，或 context 取消
	Wait(ctx context.Context) error
	// WaitN 阻塞等待直到获取 n 个令牌
	WaitN(ctx context.Context, n int) error
}

// TokenBucket 令牌桶实现
type TokenBucket struct {
	mu        sync.Mutex
	capacity  float64 // 桶容量（burst）
	tokens    float64 // 当前令牌数
	rate      float64 // 每秒填充速率
	lastFill  time.Time
	lastToken time.Time // 用于 Wait 计算
}

// NewTokenBucket 创建令牌桶
// rate: 每秒产生多少个令牌
// capacity: 桶容量（burst，最大突发量）
func NewTokenBucket(rate float64, capacity int) *TokenBucket {
	if rate <= 0 {
		panic("rate must be positive")
	}
	if capacity <= 0 {
		panic("capacity must be positive")
	}
	now := time.Now()
	return &TokenBucket{
		capacity:  float64(capacity),
		tokens:    float64(capacity), // 初始满桶
		rate:      rate,
		lastFill:  now,
		lastToken: now,
	}
}

// fill 根据时间差补充令牌（懒填充）
func (tb *TokenBucket) fill() {
	now := time.Now()
	elapsed := now.Sub(tb.lastFill).Seconds()
	tb.tokens += elapsed * tb.rate
	if tb.tokens > tb.capacity {
		tb.tokens = tb.capacity
	}
	tb.lastFill = now
}

// Allow 实现 Limiter
func (tb *TokenBucket) Allow() bool {
	return tb.AllowN(1)
}

// AllowN 尝试获取 n 个令牌，非阻塞
func (tb *TokenBucket) AllowN(n int) bool {
	if n <= 0 {
		return true
	}
	tb.mu.Lock()
	defer tb.mu.Unlock()

	tb.fill()
	if tb.tokens >= float64(n) {
		tb.tokens -= float64(n)
		return true
	}
	return false
}

// Wait 实现 Limiter
func (tb *TokenBucket) Wait(ctx context.Context) error {
	return tb.WaitN(ctx, 1)
}

// WaitN 阻塞等待 n 个令牌
// 如果当前桶内足够，立即返回
// 否则计算需要等多久，用 timer 等待，同时监听 context
func (tb *TokenBucket) WaitN(ctx context.Context, n int) error {
	if n <= 0 {
		return nil
	}
	if n > int(tb.capacity) {
		// 请求量超过桶容量，永远不可能成功
		return errors.New("request exceeds bucket capacity")
	}

	// 先快速尝试一次
	tb.mu.Lock()
	tb.fill()

	if tb.tokens >= float64(n) {
		tb.tokens -= float64(n)
		tb.mu.Unlock()
		return nil
	}

	// 需要等待的时间
	needed := float64(n) - tb.tokens
	waitDuration := time.Duration(needed/tb.rate*1e9) * time.Nanosecond
	tb.tokens -= float64(n) // 预扣，防止并发下重复计算
	tb.lastToken = tb.lastFill
	tb.mu.Unlock()

	timer := time.NewTimer(waitDuration)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		// context 取消，把预扣的还回去
		tb.mu.Lock()
		tb.tokens += float64(n)
		tb.mu.Unlock()
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// Burst 返回当前 burst 容量
func (tb *TokenBucket) Burst() int {
	return int(tb.capacity)
}

// Rate 返回当前填充速率
func (tb *TokenBucket) Rate() float64 {
	return tb.rate
}

// Tokens 返回当前可用令牌数（用于监控/debug）
func (tb *TokenBucket) Tokens() float64 {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.fill()
	return tb.tokens
}