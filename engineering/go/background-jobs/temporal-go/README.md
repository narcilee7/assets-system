# Temporal (Go)

Temporal 是持久化工作流引擎，适合长时、复杂、可靠的后台流程。

## 核心概念

- Workflow：用代码定义业务流程，自动持久化状态
- Activity：具体的业务操作，可重试
- Worker：执行 Workflow 和 Activity 的进程

## 核心实现

```go
// workflow.go
package app

import (
	"time"
	"go.temporal.io/sdk/workflow"
)

type OrderWorkflow struct {
	OrderID string
	UserID  string
}

func OrderProcessingWorkflow(ctx workflow.Context, order OrderWorkflow) error {
	// 设置 Activity 选项
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// 1. 扣减库存
	var inventoryResult InventoryResult
	err := workflow.ExecuteActivity(ctx, ReserveInventory, order).Get(ctx, &inventoryResult)
	if err != nil {
		return err
	}

	// 2. 处理支付
	var paymentResult PaymentResult
	err = workflow.ExecuteActivity(ctx, ProcessPayment, order).Get(ctx, &paymentResult)
	if err != nil {
		// 补偿：释放库存
		_ = workflow.ExecuteActivity(ctx, ReleaseInventory, order).Get(ctx, nil)
		return err
	}

	// 3. 创建订单
	var orderResult OrderResult
	err = workflow.ExecuteActivity(ctx, CreateOrder, order).Get(ctx, &orderResult)
	if err != nil {
		// Saga 补偿
		_ = workflow.ExecuteActivity(ctx, RefundPayment, paymentResult).Get(ctx, nil)
		_ = workflow.ExecuteActivity(ctx, ReleaseInventory, order).Get(ctx, nil)
		return err
	}

	// 4. 发送通知
	_ = workflow.ExecuteActivity(ctx, SendNotification, order).Get(ctx, nil)

	return nil
}
```

## Activity 实现

```go
// activity.go
func ReserveInventory(ctx context.Context, order OrderWorkflow) (InventoryResult, error) {
	// 调用库存服务
	return InventoryResult{Reserved: true}, nil
}

func ProcessPayment(ctx context.Context, order OrderWorkflow) (PaymentResult, error) {
	// 调用支付网关
	return PaymentResult{TransactionID: "txn-123"}, nil
}
```
