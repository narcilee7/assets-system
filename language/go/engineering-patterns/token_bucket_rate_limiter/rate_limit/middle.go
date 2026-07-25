package ratelimit

import (
	"net/http"
	"sync"
)

// HTTPMiddleware 把 Limiter 包装成 http.Handler 中间件
// 被限流时返回 429 Too Many Requests
func HTTPMiddleware(l Limiter, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !l.Allow() {
			http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// HTTPMiddlewareWait 阻塞等待版本（适合后台任务，不推荐 API 用）
func HTTPMiddlewareWait(l Limiter, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := l.Wait(r.Context()); err != nil {
			http.Error(w, `{"error":"request cancelled"}`, http.StatusServiceUnavailable)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// PerClientLimiter 按客户端 IP 限流（演示 map + sync.RWMutex 模式）
type PerClientLimiter struct {
	mu        sync.RWMutex
	limiters  map[string]Limiter
	rate      float64
	capacity  int
}

func NewPerClientLimiter(rate float64, capacity int) *PerClientLimiter {
	return &PerClientLimiter{
		limiters: make(map[string]Limiter),
		rate:     rate,
		capacity: capacity,
	}
}

func (p *PerClientLimiter) GetLimiter(clientID string) Limiter {
	// 先读锁
	p.mu.RLock()
	l, ok := p.limiters[clientID]
	p.mu.RUnlock()
	if ok {
		return l
	}

	// 没有则创建
	p.mu.Lock()
	defer p.mu.Unlock()
	// double check
	if l, ok := p.limiters[clientID]; ok {
		return l
	}
	l = NewTokenBucket(p.rate, p.capacity)
	p.limiters[clientID] = l
	return l
}