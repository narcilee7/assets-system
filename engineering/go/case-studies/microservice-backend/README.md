# Go Microservice Backend Case Study

一个完整的 Go 微服务后端案例，演示分层架构、gRPC、消息队列和可观测性。

## 技术栈

| 层 | 技术 |
| --- | --- |
| API | Gin + gRPC Gateway |
| ORM | GORM |
| Message Queue | NATS / Asynq |
| Cache | Redis |
| Auth | JWT |
| Observability | Zap + OpenTelemetry |
| Deploy | Docker + K8s |

## 项目结构

```
cmd/
  api/           # HTTP API 入口
  worker/        # 后台任务 worker
internal/
  domain/        # 业务实体
  repository/    # 数据访问层
  service/       # 业务逻辑层
  handler/       # HTTP/gRPC 处理器
  middleware/    # 中间件
  config/        # 配置
pkg/
  logger/        # 日志封装
  tracer/        # 链路追踪
```

## 分层示例

```go
// internal/domain/order.go
package domain

type Order struct {
	ID        uint
	UserID    uint
	ProductID string
	Quantity  int
	Status    OrderStatus
}

type OrderStatus string

const (
	OrderPending  OrderStatus = "pending"
	OrderPaid     OrderStatus = "paid"
	OrderShipped  OrderStatus = "shipped"
)
```

```go
// internal/repository/order.go
package repository

import "myapp/internal/domain"

type OrderRepository interface {
	Create(order *domain.Order) error
	GetByID(id uint) (*domain.Order, error)
	UpdateStatus(id uint, status domain.OrderStatus) error
}
```

```go
// internal/service/order.go
package service

import (
	"context"
	"myapp/internal/domain"
	"myapp/internal/repository"
)

type OrderService struct {
	repo      repository.OrderRepository
	publisher EventPublisher
}

func (s *OrderService) CreateOrder(ctx context.Context, userID uint, productID string, qty int) (*domain.Order, error) {
	order := &domain.Order{
		UserID:    userID,
		ProductID: productID,
		Quantity:  qty,
		Status:    domain.OrderPending,
	}

	if err := s.repo.Create(order); err != nil {
		return nil, err
	}

	s.publisher.Publish("order.created", order)
	return order, nil
}
```
