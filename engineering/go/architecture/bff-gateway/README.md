# Go BFF 与 API Gateway

BFF（Backend for Frontend）和 API Gateway 是现代微服务架构中的关键聚合层。BFF 为特定前端（Web、iOS、Android）定制 API，处理数据聚合、字段裁剪和协议适配；API Gateway 负责统一入口、认证、限流、路由和协议转换。Go 的高并发和低延迟特性使其成为构建网关层的理想语言，常见的实现包括自研网关、Kong + Go Plugin 和基于 Envoy 的扩展。

## 核心概念

BFF 模式解决了微服务直接暴露给前端的问题：前端需要调用多个服务并自行聚合数据，导致网络往返多、耦合深。BFF 作为后端的后端，将多个下游调用合并为单个前端友好的接口。Go 的 goroutine 使得并发调用多个下游服务非常自然，通过 `errgroup` 或 `sync.WaitGroup` 实现并行请求。

API Gateway 更偏向基础设施层，处理横切关注点（Cross-Cutting Concerns）：TLS 终止、JWT 验证、速率限制、请求路由、负载均衡、缓存和日志。Go 社区有多个网关框架：`gin` 自研、`KrakenD`（Go 编写的高性能网关）、`Caddy`（可编程 Web 服务器）和基于 `fasthttp` 的轻量代理。

## 代码实现

```go
// gateway.go
package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/errgroup"
)

// ServiceRegistry 服务注册表
type ServiceRegistry struct {
	mu       sync.RWMutex
	services map[string]*url.URL
}

func NewServiceRegistry() *ServiceRegistry {
	return &ServiceRegistry{
		services: map[string]*url.URL{
			"users":     mustParseURL("http://user-service:8080"),
			"orders":    mustParseURL("http://order-service:8080"),
			"inventory": mustParseURL("http://inventory-service:8080"),
		},
	}
}

func (r *ServiceRegistry) Get(name string) (*url.URL, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.services[name]
	return u, ok
}

func mustParseURL(s string) *url.URL {
	u, err := url.Parse(s)
	if err != nil {
		panic(err)
	}
	return u
}

// APIGateway HTTP API 网关
type APIGateway struct {
	registry *ServiceRegistry
	proxies  map[string]*httputil.ReverseProxy
}

func NewAPIGateway(registry *ServiceRegistry) *APIGateway {
	g := &APIGateway{
		registry: registry,
		proxies:  make(map[string]*httputil.ReverseProxy),
	}

	// 预创建反向代理
	for name, target := range registry.services {
		g.proxies[name] = httputil.NewSingleHostReverseProxy(target)
	}

	return g
}

func (g *APIGateway) RouteHandler(c *gin.Context) {
	// 路径格式: /api/{service}/{path...}
	parts := strings.SplitN(c.Param("service"), "/", 2)
	if len(parts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing service"})
		return
	}

	serviceName := parts[0]
	proxy, ok := g.proxies[serviceName]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// 重写路径
	c.Request.URL.Path = "/" + strings.TrimPrefix(c.Param("service"), serviceName+"/")
	proxy.ServeHTTP(c.Writer, c.Request)
}
```

```go
// bff.go
package bff

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/errgroup"
)

// BFFService 为移动端提供聚合接口
type BFFService struct {
	userClient     *UserClient
	orderClient    *OrderClient
	productClient  *ProductClient
}

// UserDashboardResponse 移动端仪表盘聚合数据
type UserDashboardResponse struct {
	User     UserProfile   `json:"user"`
	Orders   []OrderSummary `json:"orders"`
	Cart     CartSummary   `json:"cart"`
	Coupons  []Coupon      `json:"coupons"`
}

func (b *BFFService) GetUserDashboard(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	var (
		user    UserProfile
		orders  []OrderSummary
		cart    CartSummary
		coupons []Coupon
	)

	// 并行调用多个下游服务
	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		var err error
		user, err = b.userClient.GetProfile(ctx, userID)
		return err
	})

	g.Go(func() error {
		var err error
		orders, err = b.orderClient.ListRecent(ctx, userID, 5)
		return err
	})

	g.Go(func() error {
		var err error
		cart, err = b.productClient.GetCart(ctx, userID)
		return err
	})

	g.Go(func() error {
		var err error
		coupons, err = b.userClient.ListCoupons(ctx, userID)
		return err
	})

	if err := g.Wait(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, UserDashboardResponse{
		User:    user,
		Orders:  orders,
		Cart:    cart,
		Coupons: coupons,
	})
}

// WebBFF 为 Web 端提供更重、更完整的聚合
type WebBFF struct {
	services *BFFService
}

func (w *WebBFF) GetOrderDetailPage(c *gin.Context) {
	orderID := c.Param("order_id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	order, err := w.services.orderClient.GetDetail(ctx, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 串行获取关联数据（有依赖关系）
	product, _ := w.services.productClient.GetProduct(ctx, order.ProductID)
	user, _ := w.services.userClient.GetProfile(ctx, order.UserID)
	logistics, _ := w.services.orderClient.GetLogistics(ctx, orderID)

	c.JSON(http.StatusOK, gin.H{
		"order":     order,
		"product":   product,
		"user":      user,
		"logistics": logistics,
		"page_meta": gin.H{
			"title":       fmt.Sprintf("Order %s", orderID),
			"description": fmt.Sprintf("Order details for %s", product.Name),
		},
	})
}
```

```go
// middleware.go
package gateway

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimiter 基于令牌桶的限流器
type RateLimiter struct {
	mu       sync.RWMutex
	limiters map[string]*rate.Limiter
	rate     rate.Limit
	burst    int
}

func NewRateLimiter(r rate.Limit, b int) *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     r,
		burst:    b,
	}
}

func (rl *RateLimiter) getLimiter(key string) *rate.Limiter {
	rl.mu.RLock()
	lim, ok := rl.limiters[key]
	rl.mu.RUnlock()
	if ok {
		return lim
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()
	lim, ok = rl.limiters[key]
	if !ok {
		lim = rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[key] = lim
	}
	return lim
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()
		if auth := c.GetHeader("Authorization"); auth != "" {
			key = auth // 按用户限流
		}

		if !rl.getLimiter(key).Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded",
			})
			return
		}
		c.Next()
	}
}

// CircuitBreaker 熔断器（简化版）
type CircuitBreaker struct {
	mu                sync.RWMutex
	failures          int
	lastFailureTime   time.Time
	threshold         int
	recoveryTimeout   time.Duration
	state             State // Closed, Open, HalfOpen
}

type State int

const (
	StateClosed State = iota
	StateOpen
	StateHalfOpen
)

func (cb *CircuitBreaker) Call(fn func() error) error {
	cb.mu.RLock()
	state := cb.state
	cb.mu.RUnlock()

	if state == StateOpen {
		if time.Since(cb.lastFailureTime) > cb.recoveryTimeout {
			cb.mu.Lock()
			cb.state = StateHalfOpen
			cb.mu.Unlock()
		} else {
			return fmt.Errorf("circuit breaker is open")
		}
	}

	err := fn()
	if err != nil {
		cb.recordFailure()
		return err
	}
	cb.recordSuccess()
	return nil
}

func (cb *CircuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailureTime = time.Now()
	if cb.failures >= cb.threshold {
		cb.state = StateOpen
	}
}

func (cb *CircuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures = 0
	cb.state = StateClosed
}
```

## 选型对比

| 方案 | 语言 | 特点 | 适用场景 |
| --- | --- | --- | --- |
| 自研 Go Gateway | Go | 完全可控，性能高 | **高定制需求** |
| KrakenD | Go | 无状态，高性能，配置驱动 | 快速部署网关 |
| Kong | Lua/OpenResty | 插件丰富，生态成熟 | 通用 API 管理 |
| Envoy + Go Plugin | C++ | 服务网格标准 | Istio/Consul 环境 |
| Caddy | Go | 自动 HTTPS，易扩展 | 边缘网关 |
| Traefik | Go | 云原生，自动服务发现 | K8s 入口 |

## 最佳实践

- **BFF 按前端拆分**：Web、App、小程序各自有独立的 BFF，避免互相妥协
- **超时叠加**：BFF 调用下游的超时总和必须小于前端调用 BFF 的超时
- **降级策略**：下游服务不可用时，BFF 返回缓存数据或部分数据，不要全盘失败
- **连接池复用**：BFF 到下游的连接应复用 HTTP keep-alive 或 gRPC 长连接
- **请求合并**：同一页面内重复的相同请求通过 DataLoader 模式合并为单次调用
- **协议翻译**：对外暴露 REST/JSON，对内使用 gRPC，BFF 负责协议转换
- **边缘缓存**：网关层对 GET 请求做 CDN/Redis 缓存，减少后端压力
