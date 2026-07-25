package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// ==================== Context Key 定义（非导出类型防冲突）====================
type ctxKey string

const (
	requestIDKey ctxKey = "requestID"
	userIDKey    ctxKey = "userID"
)

// ==================== 领域模型 ====================
type User struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type OrderStats struct {
	Total   int `json:"total"`
	Pending int `json:"pending"`
}

type Notice struct {
	ID      int64  `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

type Dashboard struct {
	User     User       `json:"user"`
	Orders   OrderStats `json:"orders"`
	Notices  []Notice   `json:"notices"`
	Announce string     `json:"announce"`
	Cost     string     `json:"cost"` // 链路耗时
	Errors   []string   `json:"errors,omitempty"`
}

// ==================== Mock 基础设施 ====================

// MockDB：模拟 MySQL/PostgreSQL，接口完全对标 *sql.DB
type MockDB struct {
	mu    sync.RWMutex
	users map[int64]User
}

func NewMockDB() *MockDB {
	db := &MockDB{users: make(map[int64]User)}
	for i := 1; i <= 5; i++ {
		db.users[int64(i)] = User{ID: int64(i), Name: fmt.Sprintf("User-%d", i)}
	}
	return db
}

// 关键：第一个参数永远是 context.Context，支持取消和超时
func (db *MockDB) GetUser(ctx context.Context, id int64) (User, error) {
	// 模拟网络 IO 延迟，同时监听 ctx.Done()
	timer := time.NewTimer(100 * time.Millisecond)
	defer timer.Stop()

	select {
	case <-timer.C:
	case <-ctx.Done():
		return User{}, ctx.Err() // 超时或被取消，立即返回
	}

	db.mu.RLock()
	defer db.mu.RUnlock()
	if u, ok := db.users[id]; ok {
		return u, nil
	}
	return User{}, fmt.Errorf("user %d not found", id)
}

// MockCache：模拟 Redis，支持 context
type MockCache struct {
	mu   sync.RWMutex
	data map[string]string
}

func NewMockCache() *MockCache {
	return &MockCache{
		data: map[string]string{
			"announce:latest": "🛠️ 系统将于今晚 00:00 进行例行维护",
		},
	}
}

func (c *MockCache) Get(ctx context.Context, key string) (string, error) {
	timer := time.NewTimer(50 * time.Millisecond)
	defer timer.Stop()

	select {
	case <-timer.C:
	case <-ctx.Done():
		return "", ctx.Err()
	}

	c.mu.RLock()
	defer c.mu.RUnlock()
	if v, ok := c.data[key]; ok {
		return v, nil
	}
	return "", fmt.Errorf("cache miss: %s", key)
}

// OrderService：模拟下游微服务（不稳定，50% 慢路径，20% 故障）
type OrderService struct{}

func (s *OrderService) GetStats(ctx context.Context, userID int64) (OrderStats, error) {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	delay := 80 * time.Millisecond
	if r.Float32() < 0.5 {
		delay = 400 * time.Millisecond // 慢路径，容易触发超时
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-timer.C:
	case <-ctx.Done():
		return OrderStats{}, ctx.Err()
	}

	if r.Float32() < 0.2 {
		return OrderStats{}, fmt.Errorf("order service: 503 unavailable")
	}

	return OrderStats{
		Total:   r.Intn(100),
		Pending: r.Intn(10),
	}, nil
}

// NoticeService：模拟下游通知服务
type NoticeService struct{}

func (s *NoticeService) List(ctx context.Context, userID int64) ([]Notice, error) {
	timer := time.NewTimer(120 * time.Millisecond)
	defer timer.Stop()

	select {
	case <-timer.C:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	return []Notice{
		{ID: 1, Title: "📦 新订单", Content: "您的订单 #12345 已发货"},
		{ID: 2, Title: "🔔 系统消息", Content: "账户安全登录提醒"},
	}, nil
}

// ==================== Middleware 链路 ====================

// tracingMiddleware：注入 RequestID 和 UserID 到 context
func tracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := fmt.Sprintf("req-%d", time.Now().UnixNano())

		// 1. 注入 RequestID
		ctx := context.WithValue(r.Context(), requestIDKey, reqID)

		// 2. 从 Query 解析 UserID（真实场景从 JWT/Session 解析）
		userID := int64(1)
		fmt.Sscanf(r.URL.Query().Get("user_id"), "%d", &userID)
		ctx = context.WithValue(ctx, userIDKey, userID)

		// 3. 用新 context 继续处理
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// timeoutMiddleware：给整个请求设置 2 秒死线
func timeoutMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 基于传入的 context 派生一个带超时的子 context
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel() // 请求结束时释放 timer，防止内存泄漏

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// loggingMiddleware：记录请求生命周期，从 context 取链路信息
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		reqID, _ := r.Context().Value(requestIDKey).(string)
		userID, _ := r.Context().Value(userIDKey).(int64)

		// 包装 ResponseWriter 以捕获状态码
		rw := &responseRecorder{ResponseWriter: w, statusCode: http.StatusOK}

		log.Printf("[%s] user=%d | %s %s | 开始", reqID, userID, r.Method, r.URL.Path)

		next.ServeHTTP(rw, r)

		log.Printf("[%s] user=%d | 耗时=%dms | 状态=%d",
			reqID, userID, time.Since(start).Milliseconds(), rw.statusCode)
	})
}

type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}

// ==================== Handler：聚合链路核心 ====================

func dashboardHandler(db *MockDB, cache *MockCache, orders *OrderService, notices *NoticeService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		reqID, _ := ctx.Value(requestIDKey).(string)
		userID, _ := ctx.Value(userIDKey).(int64)

		start := time.Now()
		var result Dashboard
		var errs []string
		var mu sync.Mutex

		// 并发聚合 4 个数据源，全部共享同一个 ctx
		// 任一数据源内部检测到 ctx.Done() 都会立即返回，不会挂死
		var wg sync.WaitGroup
		wg.Add(4)

		// 1. 用户基本信息（DB）
		go func() {
			defer wg.Done()
			user, err := db.GetUser(ctx, userID)
			if err != nil {
				mu.Lock()
				errs = append(errs, fmt.Sprintf("db: %v", err))
				mu.Unlock()
				return
			}
			result.User = user
		}()

		// 2. 订单统计（下游服务 A）
		go func() {
			defer wg.Done()
			stats, err := orders.GetStats(ctx, userID)
			if err != nil {
				mu.Lock()
				errs = append(errs, fmt.Sprintf("orders: %v", err))
				mu.Unlock()
				return
			}
			result.Orders = stats
		}()

		// 3. 通知列表（下游服务 B）
		go func() {
			defer wg.Done()
			list, err := notices.List(ctx, userID)
			if err != nil {
				mu.Lock()
				errs = append(errs, fmt.Sprintf("notices: %v", err))
				mu.Unlock()
				return
			}
			result.Notices = list
		}()

		// 4. 系统公告（Cache）
		go func() {
			defer wg.Done()
			announce, err := cache.Get(ctx, "announce:latest")
			if err != nil {
				mu.Lock()
				errs = append(errs, fmt.Sprintf("cache: %v", err))
				mu.Unlock()
				return
			}
			result.Announce = announce
		}()

		// 等待全部完成，但如果 ctx 先取消（超时），则立即返回已拿到的部分数据
		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()

		select {
		case <-done:
			// 全部 goroutine 完成（成功或失败）
			result.Cost = fmt.Sprintf("%dms", time.Since(start).Milliseconds())
			result.Errors = errs
			if len(errs) > 0 {
				log.Printf("[%s] ⚠️ 部分降级: %v", reqID, errs)
			}
		case <-ctx.Done():
			// 2 秒超时触发，返回已聚合的部分数据
			result.Cost = fmt.Sprintf("%dms(timeout)", time.Since(start).Milliseconds())
			result.Errors = append(errs, fmt.Sprintf("全局超时: %v", ctx.Err()))
			log.Printf("[%s] ⏱️ 请求超时，返回部分数据", reqID)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

// ==================== Main：启动与优雅关闭 ====================

func main() {
	// 初始化依赖
	db := NewMockDB()
	cache := NewMockCache()
	orders := &OrderService{}
	notices := &NoticeService{}

	// 路由
	mux := http.NewServeMux()
	mux.HandleFunc("/dashboard", dashboardHandler(db, cache, orders, notices))

	// 中间件链：tracing → timeout → logging → handler
	// 注意顺序：timeout 必须在 tracing 之后（才能拿到注入的 ctx），在 handler 之前
	var handler http.Handler = mux
	handler = tracingMiddleware(handler)
	handler = timeoutMiddleware(handler)
	handler = loggingMiddleware(handler)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	// 优雅关闭：监听 SIGINT/SIGTERM
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
		<-sig

		log.Println("🛑 收到关闭信号，开始优雅关闭...")

		// 给正在处理的请求 5 秒收尾时间
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("关闭失败: %v", err)
		}
	}()

	log.Println("🚀 Server 启动: http://localhost:8080")
	log.Println("🧪 测试: curl 'http://localhost:8080/dashboard?user_id=1'")
	log.Println("   多跑几次，观察订单服务偶发超时和故障的降级表现")

	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server 异常: %v", err)
	}

	log.Println("✅ Server 已关闭")
}