# Go Saga 模式实现

Saga 模式是分布式长事务的标准解决方案，由 Hector Garcia-Molina 在 1987 年提出。它将一个长事务拆分为多个有序的本地事务，每个本地事务提交后立即释放资源，如果某步失败则执行补偿操作（Compensating Transaction）回滚已完成的步骤。Go 的 channel、goroutine 和 `errgroup` 使得实现 Saga 协调器非常自然。

## 核心概念

Saga 有两种编排方式：编排式（Choreography）和协调式（Orchestration）。编排式中每个服务完成本地事务后发送事件，触发下一个服务；协调式由中央的 Saga 协调器统一管理步骤顺序和补偿。协调式更适合复杂流程，编排式更解耦。

补偿操作的设计是 Saga 的核心难点：补偿不是简单的回滚（因为本地事务已提交），而是执行业务上的反向操作。例如创建订单的补偿是取消订单，扣减库存的补偿是归还库存。补偿本身也可能失败，需要支持重试和人工介入。

## 代码实现

```go
// saga.go
package saga

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// Step 表示 Saga 中的一个步骤
type Step struct {
	Name        string
	Action      func(ctx context.Context) error
	Compensate  func(ctx context.Context) error
	RetryPolicy *RetryPolicy
}

type RetryPolicy struct {
	MaxRetries int
	Delay      time.Duration
}

// Result 单步执行结果
type Result struct {
	StepName string
	Success  bool
	Error    error
}

// Saga 协调器
type Saga struct {
	name  string
	steps []Step
}

func NewSaga(name string) *Saga {
	return &Saga{name: name}
}

func (s *Saga) AddStep(step Step) *Saga {
	s.steps = append(s.steps, step)
	return s
}

// Execute 顺序执行 Saga 步骤，失败时逆序补偿
func (s *Saga) Execute(ctx context.Context) error {
	completed := make([]int, 0, len(s.steps))

	for i, step := range s.steps {
		log.Printf("[Saga:%s] Executing step %d: %s", s.name, i, step.Name)

		if err := s.executeWithRetry(ctx, step); err != nil {
			log.Printf("[Saga:%s] Step %s failed: %v", s.name, step.Name, err)
			// 逆序补偿
			if compensateErr := s.compensate(ctx, completed); compensateErr != nil {
				return fmt.Errorf("saga failed and compensation also failed: %w", compensateErr)
			}
			return fmt.Errorf("saga step %s failed: %w", step.Name, err)
		}

		completed = append(completed, i)
		log.Printf("[Saga:%s] Step %s completed", s.name, step.Name)
	}

	return nil
}

func (s *Saga) executeWithRetry(ctx context.Context, step Step) error {
	maxRetries := 0
	var delay time.Duration
	if step.RetryPolicy != nil {
		maxRetries = step.RetryPolicy.MaxRetries
		delay = step.RetryPolicy.Delay
	}

	var err error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			log.Printf("[Saga:%s] Retrying step %s (attempt %d)", s.name, step.Name, attempt)
			time.Sleep(delay)
		}
		err = step.Action(ctx)
		if err == nil {
			return nil
		}
	}
	return err
}

func (s *Saga) compensate(ctx context.Context, completed []int) error {
	log.Printf("[Saga:%s] Starting compensation for %d steps", s.name, len(completed))

	// 逆序补偿
	for i := len(completed) - 1; i >= 0; i-- {
		stepIndex := completed[i]
		step := s.steps[stepIndex]
		if step.Compensate == nil {
			continue
		}

		log.Printf("[Saga:%s] Compensating step: %s", s.name, step.Name)
		if err := step.Compensate(ctx); err != nil {
			log.Printf("[Saga:%s] Compensation failed for %s: %v", s.name, step.Name, err)
			// 补偿失败不中断，继续尝试补偿前面的步骤
			// 实际生产中应记录到待处理队列人工介入
		}
	}
	return nil
}

// ParallelSaga 支持并行步骤的 Saga
type ParallelSaga struct {
	name    string
	groups  [][]Step // 每组内部并行，组间顺序
}

func NewParallelSaga(name string) *ParallelSaga {
	return &ParallelSaga{name: name}
}

func (ps *ParallelSaga) AddParallelGroup(steps ...Step) *ParallelSaga {
	ps.groups = append(ps.groups, steps)
	return ps
}

func (ps *ParallelSaga) Execute(ctx context.Context) error {
	var allCompleted []Step

	for _, group := range ps.groups {
		// 并行执行组内步骤
		results := make([]struct {
			step    Step
			success bool
			err     error
		}, len(group))

		var wg sync.WaitGroup
		for i, step := range group {
			wg.Add(1)
			go func(idx int, s Step) {
				defer wg.Done()
				err := s.Action(ctx)
				results[idx] = struct {
					step    Step
					success bool
					err     error
				}{step: s, success: err == nil, err: err}
			}(i, step)
		}
		wg.Wait()

		// 检查是否有失败
		var failedStep *Step
		for _, r := range results {
			if r.success {
				allCompleted = append(allCompleted, r.step)
			} else {
				failedStep = &r.step
				break
			}
		}

		if failedStep != nil {
			// 补偿所有已完成的步骤（包括当前组成功的）
			ps.compensateAll(ctx, allCompleted)
			return fmt.Errorf("parallel saga failed at step %s", failedStep.Name)
		}
	}

	return nil
}

func (ps *ParallelSaga) compensateAll(ctx context.Context, steps []Step) {
	for i := len(steps) - 1; i >= 0; i-- {
		if steps[i].Compensate != nil {
			_ = steps[i].Compensate(ctx)
		}
	}
}
```

```go
// order_saga.go
package saga

import (
	"context"
	"fmt"
)

// OrderSagaBuilder 构建订单创建 Saga
func BuildOrderSaga(
	orderSvc OrderService,
	inventorySvc InventoryService,
	paymentSvc PaymentService,
	notificationSvc NotificationService,
) *Saga {
	return NewSaga("create-order").
		AddStep(Step{
			Name: "create_order",
			Action: func(ctx context.Context) error {
				return orderSvc.Create(ctx, Order{ID: "ORD-001", Status: "pending"})
			},
			Compensate: func(ctx context.Context) error {
				return orderSvc.Cancel(ctx, "ORD-001")
			},
			RetryPolicy: &RetryPolicy{MaxRetries: 2, Delay: 1},
		}).
		AddStep(Step{
			Name: "deduct_inventory",
			Action: func(ctx context.Context) error {
				return inventorySvc.Deduct(ctx, "PROD-001", 1)
			},
			Compensate: func(ctx context.Context) error {
				return inventorySvc.Restore(ctx, "PROD-001", 1)
			},
		}).
		AddStep(Step{
			Name: "process_payment",
			Action: func(ctx context.Context) error {
				return paymentSvc.Charge(ctx, "USER-001", 99.99)
			},
			Compensate: func(ctx context.Context) error {
				return paymentSvc.Refund(ctx, "USER-001", 99.99)
			},
		}).
		AddStep(Step{
			Name: "send_notification",
			Action: func(ctx context.Context) error {
				return notificationSvc.Send(ctx, "USER-001", "Order confirmed")
			},
			Compensate: nil, // 通知无需补偿
		})
}

// 接口定义（简化）
type OrderService interface {
	Create(ctx context.Context, order Order) error
	Cancel(ctx context.Context, orderID string) error
}

type InventoryService interface {
	Deduct(ctx context.Context, productID string, qty int) error
	Restore(ctx context.Context, productID string, qty int) error
}

type PaymentService interface {
	Charge(ctx context.Context, userID string, amount float64) error
	Refund(ctx context.Context, userID string, amount float64) error
}

type NotificationService interface {
	Send(ctx context.Context, userID, message string) error
}

type Order struct {
	ID     string
	Status string
}
```

```go
// state_machine.go
package saga

import (
	"context"
	"encoding/json"
	"time"
)

// SagaState 持久化 Saga 状态
type SagaState struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Status    string          `json:"status"` // running, succeeded, failed, compensating
	Steps     []StepState     `json:"steps"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type StepState struct {
	Name       string    `json:"name"`
	Status     string    `json:"status"` // pending, succeeded, failed, compensated
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at,omitempty"`
	Error      string    `json:"error,omitempty"`
}

// PersistentSagaStore 持久化存储接口
type PersistentSagaStore interface {
	Save(ctx context.Context, state *SagaState) error
	Get(ctx context.Context, sagaID string) (*SagaState, error)
	UpdateStep(ctx context.Context, sagaID string, stepName, status, errMsg string) error
}

// PersistentSaga 支持状态持久化的 Saga
type PersistentSaga struct {
	Saga
	store PersistentSagaStore
	id    string
}

func (ps *PersistentSaga) Execute(ctx context.Context) error {
	state := &SagaState{
		ID:        ps.id,
		Name:      ps.name,
		Status:    "running",
		CreatedAt: time.Now(),
	}
	_ = ps.store.Save(ctx, state)

	err := ps.Saga.Execute(ctx)
	if err != nil {
		state.Status = "failed"
	} else {
		state.Status = "succeeded"
	}
	state.UpdatedAt = time.Now()
	_ = ps.store.Save(ctx, state)

	return err
}
```

## 选型对比

| 特性 | 协调式 Saga | 编排式 Saga |
| --- | --- | --- |
| 流程可见性 | 高（中央视图） | 低（分散在事件流中） |
| 服务耦合 | 协调器依赖服务接口 | 服务间通过事件解耦 |
| 复杂度 | 逻辑集中在协调器 | 需要理解全局事件流 |
| 回滚控制 | 精确控制补偿顺序 | 依赖消费者自行处理 |
| 调试难度 | 较低 | 较高 |
| 适用 | 复杂业务流程 | 简单、事件驱动架构 |

## 最佳实践

- **补偿幂等**：补偿操作必须幂等，因为网络超时可能导致重复调用
- **状态持久化**：Saga 状态必须持久化到数据库，支持断点恢复和人工介入
- **超时设计**：每个 Action 和 Compensate 都要设置 timeout，防止无限阻塞
- **死信队列**：补偿失败的消息进入 DLQ，触发人工处理流程
- **监控可视化**：每个 Saga 实例的状态应在 Dashboard 中实时展示
- **避免嵌套 Saga**：嵌套 Saga 增加复杂度，扁平化设计更易维护
- **业务语义补偿**：补偿不是数据库回滚，而是业务上的反向操作（如退款、取消）
