# Echo & Fiber

Echo 和 Fiber 是 Go 生态中另外两个主流 Web 框架，与 Gin 形成三足鼎立。

## Echo

Echo 以极简 API 和出色性能著称，内置路由、中间件、验证和错误处理。

```go
// echo_app.go
package main

import (
	"net/http"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	e := echo.New()

	// 内置中间件
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())
	e.Use(middleware.Gzip())

	// 路由组
	api := e.Group("/api/v1")
	api.GET("/users", getUsers)
	api.POST("/users", createUser)

	// 验证
	e.Validator = &CustomValidator{}
	e.POST("/login", login)

	e.Start(":8080")
}

func getUsers(c echo.Context) error {
	return c.JSON(http.StatusOK, []string{"alice", "bob"})
}

func createUser(c echo.Context) error {
	user := new(User)
	if err := c.Bind(user); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusCreated, user)
}
```

## Fiber

Fiber 受 Express.js 启发，基于 fasthttp，是 Go 最快的 Web 框架。

```go
// fiber_app.go
package main

import "github.com/gofiber/fiber/v2"

func main() {
	app := fiber.New(fiber.Config{
		AppName:      "My App",
		Prefork:      true, // 多进程模式
		ErrorHandler: customErrorHandler,
	})

	app.Get("/api/users", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"users": []string{"alice", "bob"}})
	})

	app.Post("/api/users", func(c *fiber.Ctx) error {
		user := new(User)
		if err := c.BodyParser(user); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(201).JSON(user)
	})

	app.Listen(":8080")
}
```

## 选型对比

| 维度 | Gin | Echo | Fiber |
| --- | --- | --- | --- |
| 性能 | 快 | 快 | 最快（fasthttp） |
| 路由 | 强大 | 强大 | 强大 |
| 中间件 | 丰富 | 丰富内置 | 丰富 |
| 验证 | 手动 | 内置 | 手动 |
| 生态 | 最大 | 大 | 增长中 |
| 推荐场景 | 通用 | API 服务 | 高并发、IO 密集 |
