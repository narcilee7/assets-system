package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

// Middleware 是中间件函数签名：接收一个 Handler，返回一个包裹后的 Handler
type Middleware func(http.Handler) http.Handler

// Chain 把多个 middleware 按顺序组合，最后套在 handler 上
// 注意：传入的顺序是执行顺序，最左边的最先接触到请求
func Chain(mws ...Middleware) Middleware {
	return func(final http.Handler) http.Handler {
		// 从后往前包，保证顺序正确
		for i := len(mws) - 1; i >= 0; i-- {
			final = mws[i](final)
		}
		return final
	}
}

// Apply 是语法糖：直接应用到 http.Handler
func Apply(h http.Handler, mws ...Middleware) http.Handler {
	return Chain(mws...)(h)
}

// ============ 常用中间件实现 ============

// Logger 记录请求方法和耗时
func Logger(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			// 用 ResponseWriter 包装器捕获状态码
			wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

			next.ServeHTTP(wrapped, r)

			logger.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", wrapped.statusCode,
				"duration", time.Since(start),
			)
		})
	}
}

// Recovery 捕获 panic，防止单个请求搞崩整个服务
func Recovery(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					logger.Error("panic recovered",
						"error", err,
						"stack", string(debug.Stack()),
					)
					http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// Timeout 给请求设置整体超时，通过 context 传递
func Timeout(timeout time.Duration) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			// 用 channel 检测 handler 是否按时返回
			done := make(chan struct{})
			panicChan := make(chan any, 1)

			go func() {
				defer func() {
					if p := recover(); p != nil {
						panicChan <- p
					}
				}()
				next.ServeHTTP(w, r.WithContext(ctx))
				close(done)
			}()

			select {
			case <-ctx.Done():
				// 超时了，但 handler 可能还在跑；我们不能再写 response
				// 实际生产里这里通常配合 http.TimeoutHandler 或自定义机制
				// 这里演示核心模式
				http.Error(w, `{"error":"request timeout"}`, http.StatusGatewayTimeout)
			case p := <-panicChan:
				panic(p) // 抛给外层 Recovery 处理
			case <-done:
				// 正常完成
			}
		})
	}
}

// RequestID 注入 / 透传请求追踪 ID
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = generateID() // 你的 ID 生成逻辑
		}
		ctx := context.WithValue(r.Context(), "request_id", id) // 生产建议用不导出的 key type
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Auth 简单的 Bearer Token 校验（演示用）
func Auth(token string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth != "Bearer "+token {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ============ ResponseWriter 包装器 ============

// responseWriter 拦截 WriteHeader 以捕获状态码
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.written {
		rw.statusCode = code
		rw.written = true
		rw.ResponseWriter.WriteHeader(code)
	}
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.written {
		rw.WriteHeader(http.StatusOK)
	}
	return rw.ResponseWriter.Write(b)
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}