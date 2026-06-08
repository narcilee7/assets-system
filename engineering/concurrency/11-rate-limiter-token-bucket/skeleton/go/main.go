package main

import (
	"fmt"
	"sync"
	"time"
)

// TokenBucket 令牌桶限流器。
// TODO: 添加容量、速率、当前令牌数、上次填充时间等字段。
type TokenBucket struct {
	mu sync.Mutex
	// TODO
}

// NewTokenBucket 创建限流器。
// capacity: 桶容量；rate: 每秒产生的令牌数。
func NewTokenBucket(capacity int, rate float64) *TokenBucket {
	// TODO: 初始化
	return &TokenBucket{}
}

// Allow 尝试获取 1 个令牌。成功返回 true，否则返回 false。
func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	// TODO:
	// 1. 根据当前时间和上次填充时间计算应添加的令牌数
	// 2. 更新令牌数和上次填充时间
	// 3. 如果令牌数 >= 1，减 1 并返回 true；否则返回 false
	return false
}

func main() {
	tb := NewTokenBucket(5, 2) // 容量 5，每秒 2 个令牌

	// 先快速请求，耗尽桶中初始令牌
	allowed := 0
	for i := 0; i < 10; i++ {
		if tb.Allow() {
			allowed++
		}
	}
	if allowed == 5 {
		fmt.Printf("PASS: burst allowed = %d (capacity = 5)\n", allowed)
	} else {
		fmt.Printf("FAIL: burst allowed = %d (expected 5)\n", allowed)
	}

	// 等待 1 秒，应该产生约 2 个新令牌
	time.Sleep(1 * time.Second)
	allowed = 0
	for i := 0; i < 10; i++ {
		if tb.Allow() {
			allowed++
		}
	}
	if allowed == 2 {
		fmt.Printf("PASS: sustained allowed = %d (rate = 2/sec)\n", allowed)
	} else {
		fmt.Printf("FAIL: sustained allowed = %d (expected 2)\n", allowed)
	}
}
