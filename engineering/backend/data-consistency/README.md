# Data Consistency

数据一致性是后端架构的核心。目标是识别哪些地方必须强一致，哪些地方可以最终一致，以及失败后如何恢复。

## 核心概念

| 概念 | 关键点 |
| --- | --- |
| Transaction Boundary | 单事务能覆盖的真实边界 |
| Idempotency | 重复请求和重复消息安全 |
| Outbox | 数据变更和事件发布同事务 |
| Saga | 长事务拆成可补偿步骤 |
| Eventual Consistency | 状态收敛和用户可见性 |
| Reconciliation | 对账、修复、补偿 |

## 资产

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| transaction boundary + idempotency key | tested | `transaction-boundary/`：幂等状态机、冲突策略、TTL、事务边界判断 |
| outbox pattern | todo | 本地事务 + 事件发布 |
| saga workflow | todo | step、compensation |
| reconciliation job | todo | 对账和修复 |

## 追问

- 失败发生在 commit 之后、事件发布之前怎么办？
- 消息重复消费怎么办？
- 补偿失败怎么办？
- 用户看到中间状态是否可接受？

