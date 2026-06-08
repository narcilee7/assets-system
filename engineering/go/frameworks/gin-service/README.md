# Gin Web Service

Gin 是 Go 生态最流行的 Web 框架，以高性能和易用性著称。

## 核心实现

```go
// main.go
package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.New()

	// 中间件
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(requestIDMiddleware())
	r.Use(errorMiddleware())

	// 路由
	r.GET("/health", healthHandler)

	api := r.Group("/api/v1")
	{
		api.GET("/users/:id", getUserHandler)
		api.POST("/users", createUserHandler)
		api.PUT("/users/:id", updateUserHandler)
		api.DELETE("/users/:id", deleteUserHandler)
	}

	r.Run(":8080")
}

func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("request_id", generateRequestID())
		c.Next()
	}
}

func errorMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			err := c.Errors.Last()
			c.JSON(-1, gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Err.Error(),
			})
		}
	}
}

func healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

type CreateUserRequest struct {
	Name  string `json:"name" binding:"required,min=1,max=100"`
	Email string `json:"email" binding:"required,email"`
	Age   int    `json:"age" binding:"omitempty,gte=0,lte=150"`
}

func createUserHandler(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_ERROR",
			"message": err.Error(),
		})
		return
	}

	user := createUser(req)
	c.JSON(http.StatusCreated, user)
}

func generateRequestID() string {
	return time.Now().Format("20060102150405") + randomString(6)
}

func randomString(n int) string {
	// simplified
	return "abc123"
}

func createUser(req CreateUserRequest) map[string]interface{} {
	return map[string]interface{}{
		"id":    1,
		"name":  req.Name,
		"email": req.Email,
		"age":   req.Age,
	}
}
```

## 中间件链

```go
// middleware.go
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code": "UNAUTHORIZED",
			})
			return
		}
		// validate token
		c.Set("user_id", "123")
		c.Next()
	}
}

func rateLimitMiddleware() gin.HandlerFunc {
	// simplified token bucket
	return func(c *gin.Context) {
		// check rate limit
		c.Next()
	}
}
```

## Gin vs Echo vs Fiber

| 维度 | Gin | Echo | Fiber |
| --- | --- | --- | --- |
| 性能 | 高 | 高 | 极高（fasthttp） |
| 路由 | 基于 httprouter | 自研 | 基于 fasthttp |
| 中间件 | 丰富 | 丰富 | 丰富 |
| 学习曲线 | 低 | 低 | 低 |
| 生态 | 最大 | 大 | 增长中 |
| 推荐 | 通用首选 | 简洁偏好 | 极致性能 |
