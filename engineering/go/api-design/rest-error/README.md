# Go API Error Model

Go 没有异常机制，错误处理是显式的。设计一致、可追踪、可恢复的错误模型是 Go API 可靠性的基石。

## 核心设计

```go
// errors.go
package apperror

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// AppError 是应用层错误
type AppError struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	StatusCode int                   `json:"status_code"`
	Details   map[string]interface{} `json:"details,omitempty"`
	TraceID   string                 `json:"trace_id,omitempty"`
	Retryable bool                   `json:"retryable,omitempty"`
}

func (e *AppError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func New(code string, message string, status int) *AppError {
	return &AppError{Code: code, Message: message, StatusCode: status}
}

// 预定义错误
var (
	ErrValidation    = New("VALIDATION_ERROR", "Request validation failed", http.StatusBadRequest)
	ErrUnauthorized  = New("UNAUTHORIZED", "Authentication required", http.StatusUnauthorized)
	ErrNotFound      = New("NOT_FOUND", "Resource not found", http.StatusNotFound)
	ErrConflict      = New("CONFLICT", "Resource conflict", http.StatusConflict)
	ErrRateLimited   = New("RATE_LIMITED", "Too many requests", http.StatusTooManyRequests)
	ErrInternal      = New("INTERNAL_ERROR", "Internal server error", http.StatusInternalServerError)
	ErrUnavailable   = New("SERVICE_UNAVAILABLE", "Service temporarily unavailable", http.StatusServiceUnavailable)
)

func (e *AppError) WithDetails(details map[string]interface{}) *AppError {
	e.Details = details
	return e
}

func (e *AppError) WithTraceID(id string) *AppError {
	e.TraceID = id
	return e
}

func (e *AppError) IsRetryable() *AppError {
	e.Retryable = true
	return e
}
```

## Gin 错误中间件

```go
// error_middleware.go
package middleware

import (
	"net/http"
	"github.com/gin-gonic/gin"
	"myapp/apperror"
)

func ErrorMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) == 0 {
			return
		}

		err := c.Errors.Last().Err
		traceID := c.GetString("trace_id")

		switch e := err.(type) {
		case *apperror.AppError:
			c.JSON(e.StatusCode, e.WithTraceID(traceID))
		default:
			c.JSON(http.StatusInternalServerError, apperror.ErrInternal.WithTraceID(traceID))
		}
	}
}

// 使用
c.JSON(-1, apperror.ErrValidation.WithDetails(map[string]interface{}{
	"field": "email",
	"issue": "invalid format",
}))
```

## 错误包装（Go 1.13+ errors.Is/As）

```go
// error_wrapping.go
package main

import (
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("not found")

func findUser(id string) error {
	// 模拟数据库查询失败
	return fmt.Errorf("db query failed: %w", ErrNotFound)
}

func main() {
	err := findUser("123")
	
	if errors.Is(err, ErrNotFound) {
		fmt.Println("User not found")
	}
	
	// unwrap
	var target error
	if errors.As(err, &target) {
		fmt.Println("Underlying:", target)
	}
}
```

## 最佳实践

- **Sentinel Errors**：定义包级错误变量，用 `errors.Is` 判断。
- **不暴露内部错误**：生产环境不返回堆栈，映射为通用错误码。
- **结构化日志**：错误日志包含 trace_id、user_id、请求路径。
- **错误码规范**：统一错误码，方便客户端做分支判断。
