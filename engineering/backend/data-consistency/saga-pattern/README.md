# Saga Pattern：长事务补偿模式

## 目标

训练 Saga 模式的设计和实现。Saga 用于处理跨多个服务的长事务，每个步骤都有对应的补偿操作。当某一步失败时，之前已完成的步骤需要按反向顺序执行补偿操作。

## 场景

电商下单流程：
1. 创建订单（Order Service）
2. 预留库存（Inventory Service）
3. 支付（Payment Service）
4. 发货（Shipping Service）

如果支付失败，需要：
- 释放预留库存（补偿步骤 2）
- 取消订单（补偿步骤 1）

## 核心考点

- **步骤 + 补偿**：每个步骤定义正向操作和补偿操作
- **反向补偿**：失败时按相反顺序执行补偿
- **幂等补偿**：补偿操作必须幂等，可能被多次调用
- **状态机**：Saga 的状态流转（running → completed / compensating / failed）
- **超时处理**：步骤超时如何处理
- **并发控制**：多个 Saga 实例对同一资源的竞争

## 边界条件

- **步骤超时**：是否算成功？需要配置超时处理策略
- **补偿失败**：补偿失败后的处理策略（重试、告警、人工介入）
- **部分补偿成功**：某些补偿成功、某些失败
- **嵌套 Saga**：一个 Saga 的步骤可以是另一个 Saga
- **并发 Saga**：同一资源的多个 Saga 并发执行

## 实现思路

### Saga 定义
```typescript
interface SagaStep<TContext> {
  name: string;
  execute(ctx: TContext): Promise<void>;
  compensate(ctx: TContext): Promise<void>;
}

interface SagaOptions {
  maxRetries?: number;        // 补偿最大重试次数
  retryDelayMs?: number;      // 补偿重试间隔
  timeoutMs?: number;         // 步骤超时
  onStepFailed?: (step: string, error: Error, ctx: unknown) => void;
  onSagaCompleted?: (ctx: unknown) => void;
  onSagaFailed?: (error: Error, ctx: unknown, compensated: boolean) => void;
}
```

### 状态机
```
running → completed  (所有步骤成功)
running → compensating → failed  (补偿完成但仍有错误)
running → failed  (补偿失败或无需补偿)
```

### 补偿执行顺序
1. 记录失败步骤和错误
2. 对已完成步骤按相反顺序执行补偿
3. 补偿成功继续下一步补偿
4. 补偿失败重试（如果配置允许）

## 复杂度

- **时间复杂度**：O(n) 执行 + O(k) 补偿，k 为已完成的步骤数
- **空间复杂度**：O(n) 存储步骤定义 + O(1) 运行时状态

## 面试追问

- Saga 和 2PC（两阶段提交）的区别？
  （答：2PC 是同步阻塞的，需要锁定资源；Saga 是异步的，通过补偿解决问题。2PC 提供原子性，Saga 提供最终一致性。）
- Saga 的补偿和回滚有什么区别？
  （答：回滚是撤销已提交的操作（数据库回滚）；补偿是执行一个反向操作（释放库存）。数据库回滚只能撤销本地事务，Saga 可以跨服务。）
- 如何保证补偿的幂等性？
  （答：补偿操作设计为幂等的，或者使用幂等键。）
- 如果补偿本身也失败了怎么办？
  （答：重试机制 + 告警 + 人工介入；或者使用死信队列。）
- Saga 适合什么场景？
  （答：适合长流程、跨服务、一致性要求不高的场景。不适合强一致性要求的场景。）

## 工程迁移

- **AWS Step Functions**：托管 Saga 实现
- **Axon Framework**：Java Saga 实现
- **Conductor**：Netflix 开源 Saga 编排器
- **Eventuate Tram**：基于事件的 Saga 实现

## 相关模式

- `data-consistency/outbox-pattern/`：Saga 常用 Outbox 保证事件可靠
- `data-consistency/transaction-boundary/`：单服务内事务边界
- `reliability/stability-patterns/`：重试和超时处理