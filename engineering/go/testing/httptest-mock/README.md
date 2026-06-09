# Go HTTP 测试与 Mock

Go 的 `net/http/httptest` 包提供了无需监听真实端口的 HTTP 测试能力，是测试 Web 处理程序、中间件和客户端的标准工具。配合接口（Interface）进行依赖注入，Go 可以构建完全隔离的单元测试，无需外部数据库或第三方服务。

## 核心概念

`httptest.ResponseRecorder` 实现了 `http.ResponseWriter` 接口，可以捕获处理函数的响应状态码、响应头和 body。`httptest.NewServer` 启动一个真实但随机的本地端口服务器，用于集成测试外部 HTTP 客户端。这种设计体现了 Go 的接口哲学：通过标准接口解耦，测试时替换为测试专用实现。

Mock 在 Go 中通常有两种方式：1）为外部依赖定义接口，测试时提供手工 mock 实现；2）使用代码生成工具（`mockgen`）自动生成 mock。接口是 Go 最轻量的抽象，零运行时开销，使得测试驱动开发（TDD）非常自然。

## 代码实现

```go
// handler_test.go
package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateOrderHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 构造 mock 服务
	mockOrderSvc := &mockOrderService{}
	handler := NewOrderHandler(mockOrderSvc)

	// 构造路由
	r := gin.New()
	r.POST("/orders", handler.CreateOrder)

	tests := []struct {
		name       string
		body       map[string]interface{}
		mockSetup  func()
		wantStatus int
		wantCode   string
	}{
		{
			name: "success",
			body: map[string]interface{}{
				"product_id": "P123",
				"quantity":   2,
			},
			mockSetup: func() {
				mockOrderSvc.createFunc = func(req CreateOrderRequest) (*Order, error) {
					return &Order{ID: "ORD-001", ProductID: "P123", Quantity: 2}, nil
				}
			},
			wantStatus: http.StatusCreated,
			wantCode:   "ORD-001",
		},
		{
			name: "invalid request",
			body: map[string]interface{}{
				"product_id": "",
				"quantity":   0,
			},
			mockSetup: func() {
				mockOrderSvc.createFunc = nil
			},
			wantStatus: http.StatusBadRequest,
			wantCode:   "",
		},
		{
			name: "service error",
			body: map[string]interface{}{
				"product_id": "P123",
				"quantity":   2,
			},
			mockSetup: func() {
				mockOrderSvc.createFunc = func(req CreateOrderRequest) (*Order, error) {
					return nil, errors.New("database connection failed")
				}
			},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.mockSetup != nil {
				tt.mockSetup()
			}

			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantCode != "" {
				var resp Order
				err := json.Unmarshal(w.Body.Bytes(), &resp)
				require.NoError(t, err)
				assert.Equal(t, tt.wantCode, resp.ID)
			}
		})
	}
}

// mockOrderService 手工 mock
type mockOrderService struct {
	createFunc func(req CreateOrderRequest) (*Order, error)
}

func (m *mockOrderService) Create(req CreateOrderRequest) (*Order, error) {
	if m.createFunc != nil {
		return m.createFunc(req)
	}
	return nil, errors.New("not implemented")
}
```

```go
// client_test.go
package client

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// PaymentClient 调用外部支付网关
type PaymentClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

func NewPaymentClient(baseURL string) *PaymentClient {
	return &PaymentClient{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *PaymentClient) Charge(req ChargeRequest) (*ChargeResponse, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequest(http.MethodPost, c.BaseURL+"/charge", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("payment failed: status %d", resp.StatusCode)
	}

	var result ChargeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func TestPaymentClient_Charge(t *testing.T) {
	// 使用 httptest.NewServer 模拟外部服务
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/charge", r.URL.Path)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		var req ChargeRequest
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(t, err)

		if req.Amount <= 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid amount"})
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(ChargeResponse{
			TransactionID: "TXN-12345",
			Status:        "success",
		})
	}))
	defer server.Close()

	client := NewPaymentClient(server.URL)

	t.Run("successful charge", func(t *testing.T) {
		resp, err := client.Charge(ChargeRequest{Amount: 100.0, Currency: "USD"})
		require.NoError(t, err)
		assert.Equal(t, "TXN-12345", resp.TransactionID)
		assert.Equal(t, "success", resp.Status)
	})

	t.Run("invalid amount", func(t *testing.T) {
		_, err := client.Charge(ChargeRequest{Amount: -10, Currency: "USD"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "payment failed")
	})
}
```

```go
// gomock_example_test.go
package api

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

// 假设有接口定义在 service.go
//go:generate mockgen -source=service.go -package=api -destination=mock_service.go

type OrderRepository interface {
	GetByID(id string) (*Order, error)
	Create(order *Order) error
	UpdateStatus(id string, status string) error
}

func TestOrderServiceWithGomock(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := NewMockOrderRepository(ctrl)

	// 设置期望
	mockRepo.EXPECT().GetByID("123").Return(&Order{ID: "123", Status: "pending"}, nil)
	mockRepo.EXPECT().UpdateStatus("123", "paid").Return(nil)

	svc := NewOrderService(mockRepo)
	order, err := svc.GetOrder("123")
	assert.NoError(t, err)
	assert.Equal(t, "pending", order.Status)

	err = svc.PayOrder("123")
	assert.NoError(t, err)
}
```

```go
// integration_test.go
package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestMiddlewareChain 测试中间件组合
func TestMiddlewareChain(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// 组合中间件
	wrapped := LoggingMiddleware(
		AuthMiddleware(
			RateLimitMiddleware(handler),
		),
	)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer valid-token")

	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}
```

## 选型对比

| 方案 | 类型 | 代码生成 | 灵活性 | 推荐场景 |
| --- | --- | --- | --- | --- |
| 手工接口 mock | 轻量 | 否 | 高 | **日常首选** |
| gomock | 代码生成 | 是 | 中 | 大型接口，期望验证 |
| mockery | 代码生成 | 是 | 中 | 批量生成，自动化 |
| testify/mock | 反射 | 否 | 高 | 快速原型 |
| httptest | HTTP 测试 | 否 | 高 | **所有 HTTP 测试** |
| sqlite :memory: | DB 集成 | 否 | 高 | 数据库层测试 |

## 最佳实践

- **接口隔离**：为外部依赖（DB、HTTP、Cache）定义小接口，便于 mock
- **httptest > 真实端口**：除非测试网络超时，否则始终用 `httptest`
- **表驱动 + 子测试**：HTTP handler 测试用表格驱动，每个场景一个 `t.Run`
- **断言库选择**：`testify/assert` 简洁，`require` 用于必须成功的检查点
- **gomock 匹配器**：使用 `gomock.Any()`、`gomock.Eq()`、`gomock.Len()` 精确控制期望
- **清理资源**：`t.Cleanup()` 或 `defer ctrl.Finish()` 确保 mock 验证执行
- **并行测试**：无共享状态的 HTTP 测试加 `t.Parallel()`，但注意全局状态如 `gin.Mode`
