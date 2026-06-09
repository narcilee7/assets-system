# Go 分布式事务

分布式事务是微服务架构中最复杂的挑战之一。当业务操作跨越多个数据库或服务时，传统的 ACID 事务不再适用。Go 生态中常见的分布式事务方案包括：两阶段提交（2PC）、TCC（Try-Confirm-Cancel）、Saga 和本地消息表。Go 的强类型和并发模型使得实现这些模式相对安全，但仍需深入理解一致性和可用性的权衡。

## 核心概念

CAP 定理指出分布式系统无法同时满足一致性（Consistency）、可用性（Availability）和分区容错性（Partition Tolerance）。分布式事务通常选择放弃强一致性，追求最终一致性（Eventual Consistency）。

2PC 通过协调者（Coordinator）管理参与者（Participants），分为准备阶段和提交阶段。虽然理论成熟，但 2PC 存在协调者单点故障和阻塞问题。TCC 将每个操作拆分为 Try（预留资源）、Confirm（确认执行）和 Cancel（释放资源），适用于金融等对一致性要求高的场景。Saga 将长事务拆分为本地事务序列，通过补偿操作处理失败，适合业务流程长、需要高可用的场景。

## 代码实现

```go
// 2pc_coordinator.go
package dtx

import (
	"context"
	"fmt"
	"sync"
)

// TwoPhaseCommit 简化版两阶段提交协调器
type TwoPhaseCommit struct {
	participants []Participant
}

type Participant interface {
	Prepare(ctx context.Context) error
	Commit(ctx context.Context) error
	Rollback(ctx context.Context) error
}

func (c *TwoPhaseCommit) Execute(ctx context.Context) error {
	// Phase 1: Prepare
	for _, p := range c.participants {
		if err := p.Prepare(ctx); err != nil {
			// 通知已 prepare 的参与者回滚
			c.rollbackAll(ctx)
			return fmt.Errorf("prepare failed: %w", err)
		}
	}

	// Phase 2: Commit
	for _, p := range c.participants {
		if err := p.Commit(ctx); err != nil {
			// 记录告警，需要人工介入或异步重试
			return fmt.Errorf("commit failed (requires manual fix): %w", err)
		}
	}

	return nil
}

func (c *TwoPhaseCommit) rollbackAll(ctx context.Context) {
	for _, p := range c.participants {
		_ = p.Rollback(ctx) // 忽略错误，尽力回滚
	}
}
```

```go
// tcc.go
package dtx

import (
	"context"
	"fmt"
)

// TCCAction TCC 三阶段接口
type TCCAction interface {
	Try(ctx context.Context) error
	Confirm(ctx context.Context) error
	Cancel(ctx context.Context) error
}

// TCCCoordinator TCC 协调器
type TCCCoordinator struct {
	actions []TCCAction
}

func (tc *TCCCoordinator) Execute(ctx context.Context) error {
	// Try 阶段
	for _, action := range tc.actions {
		if err := action.Try(ctx); err != nil {
			tc.cancelAll(ctx)
			return fmt.Errorf("try failed: %w", err)
		}
	}

	// Confirm 阶段
	for _, action := range tc.actions {
		if err := action.Confirm(ctx); err != nil {
			// Confirm 失败需要记录，人工介入或不断重试
			return fmt.Errorf("confirm failed (requires retry): %w", err)
		}
	}

	return nil
}

func (tc *TCCCoordinator) cancelAll(ctx context.Context) {
	for _, action := range tc.actions {
		_ = action.Cancel(ctx)
	}
}

// OrderTCCAction 订单服务 TCC 实现
type OrderTCCAction struct {
	orderID string
	repo    OrderRepository
}

func (a *OrderTCCAction) Try(ctx context.Context) error {
	// 创建预订单，状态为 PENDING
	return a.repo.CreatePending(ctx, a.orderID)
}

func (a *OrderTCCAction) Confirm(ctx context.Context) error {
	// 确认订单，状态改为 CONFIRMED
	return a.repo.UpdateStatus(ctx, a.orderID, "CONFIRMED")
}

func (a *OrderTCCAction) Cancel(ctx context.Context) error {
	// 取消预订单
	return a.repo.UpdateStatus(ctx, a.orderID, "CANCELLED")
}

// InventoryTCCAction 库存服务 TCC 实现
type InventoryTCCAction struct {
	productID string
	quantity  int
	repo      InventoryRepository
}

func (a *InventoryTCCAction) Try(ctx context.Context) error {
	// 冻结库存
	return a.repo.Freeze(ctx, a.productID, a.quantity)
}

func (a *InventoryTCCAction) Confirm(ctx context.Context) error {
	// 扣减实际库存，释放冻结
	return a.repo.Deduct(ctx, a.productID, a.quantity)
}

func (a *InventoryTCCAction) Cancel(ctx context.Context) error {
	// 释放冻结库存
	return a.repo.Unfreeze(ctx, a.productID, a.quantity)
}
```

```go
// outbox.go
package dtx

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

// OutboxEvent 本地消息表事件
type OutboxEvent struct {
	ID        string          `db:"id"`
	Topic     string          `db:"topic"`
	Payload   json.RawMessage `db:"payload"`
	Headers   json.RawMessage `db:"headers"`
	CreatedAt time.Time       `db:"created_at"`
	Published bool            `db:"published"`
}

// OutboxPublisher 使用本地消息表保证最终一致性
type OutboxPublisher struct {
	db *sql.DB
}

// PublishInTx 在业务事务中写入消息表
func (p *OutboxPublisher) PublishInTx(ctx context.Context, tx *sql.Tx, topic string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	event := OutboxEvent{
		ID:        generateID(),
		Topic:     topic,
		Payload:   data,
		CreatedAt: time.Now(),
		Published: false,
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO outbox (id, topic, payload, created_at, published) VALUES (?, ?, ?, ?, ?)`,
		event.ID, event.Topic, event.Payload, event.CreatedAt, event.Published,
	)
	return err
}

// RelayWorker 定时轮询并发布未发送消息
func (p *OutboxPublisher) RelayWorker(ctx context.Context, publisher MessagePublisher) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.relayBatch(ctx, publisher)
		}
	}
}

func (p *OutboxPublisher) relayBatch(ctx context.Context, publisher MessagePublisher) {
	rows, err := p.db.QueryContext(ctx,
		`SELECT id, topic, payload FROM outbox WHERE published = false ORDER BY created_at LIMIT 100`,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var event OutboxEvent
		if err := rows.Scan(&event.ID, &event.Topic, &event.Payload); err != nil {
			continue
		}

		if err := publisher.Publish(ctx, event.Topic, event.Payload); err != nil {
			continue // 下次重试
		}

		// 标记已发布
		_, _ = p.db.ExecContext(ctx,
			`UPDATE outbox SET published = true WHERE id = ?`, event.ID)
	}
}
```

## 选型对比

| 方案 | 一致性 | 性能 | 复杂度 | 回滚能力 | 适用场景 |
| --- | --- | --- | --- | --- | --- |
| 2PC/XA | 强一致 | 低 | 中 | 自动 | 传统单体拆分，短事务 |
| TCC | 最终一致 | 高 | 高 | 业务补偿 | 金融、库存 |
| Saga | 最终一致 | 高 | 中 | 补偿操作 | 长业务流程 |
| 本地消息表 | 最终一致 | 高 | 中 | 无 | 跨服务异步通知 |
| Seata AT | 弱一致 | 高 | 低 | 自动 | Java 生态为主 |

## 最佳实践

- **避免 2PC**：除非遗留系统，新架构优先选择 Saga 或 TCC
- **幂等设计**：所有参与分布式事务的接口必须幂等，防止网络重试导致重复执行
- **超时控制**：每个阶段设置独立的 timeout，防止长期阻塞
- **补偿可观测**：Saga 补偿操作必须记录完整日志，便于审计和人工介入
- **消息顺序**：本地消息表配合 Kafka 分区键保证同一实体的消息顺序
- **限流降级**：分布式事务的协调器本身要做限流，防止雪崩
- **监控告警**：长时间未完成的 TCC Try、Saga 步骤必须触发告警
