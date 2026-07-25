package main

import (
	"context"
	"fmt"
	"net/http"
	ratelimit "patterns/token_bucket_rate_limiter/rate_limit"
	"time"
)

func main() {
	// 每秒 10 个令牌，桶容量 20（允许突发 20 个请求）
	limiter := ratelimit.NewTokenBucket(10, 20)

	// 1. 非阻塞检查
	if limiter.Allow() {
		fmt.Println("request allowed")
	}

	// 2. 阻塞等待（适合内部任务）
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := limiter.Wait(ctx); err != nil {
		fmt.Println("wait failed:", err)
	}

	// 3. HTTP 中间件
	mux := http.NewServeMux()
	mux.HandleFunc("/api", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// 限流：每秒 100 请求，突发 200
	apiLimiter := ratelimit.NewTokenBucket(100, 200)
	handler := ratelimit.HTTPMiddleware(apiLimiter, mux)

	// 4. 按客户端限流
	clientLimiter := ratelimit.NewPerClientLimiter(5, 10)
	http.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if !clientLimiter.GetLimiter(ip).Allow() {
			http.Error(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		w.Write([]byte("ok"))
	})

	http.ListenAndServe(":8080", handler)
}