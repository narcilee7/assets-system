# Saga Pattern

Saga 是将长事务拆分为多个本地事务，每个本地事务有对应的补偿操作，通过补偿实现最终一致性。

## 两种实现方式

| 方式 | 说明 | 适用 |
| --- | --- | --- |
| 编排式 Saga（Choreography） | 每个服务完成操作后发事件，下一个服务监听事件执行 | 简单流程 |
| 协调式 Saga（Orchestration） | 中央协调器（Saga Orchestrator）控制流程 | 复杂流程 |

## 核心实现

### 协调式 Saga

```ts
// saga-orchestrator.ts
interface SagaStep {
  name: string;
  action: () => Promise<void>;
  compensate: () => Promise<void>;
}

interface SagaState {
  id: string;
  status: 'running' | 'completed' | 'compensating' | 'failed';
  currentStep: number;
  completedSteps: string[];
}

class SagaOrchestrator {
  private states = new Map<string, SagaState>();

  async execute(sagaId: string, steps: SagaStep[]) {
    const state: SagaState = {
      id: sagaId,
      status: 'running',
      currentStep: 0,
      completedSteps: [],
    };
    this.states.set(sagaId, state);

    try {
      for (let i = 0; i < steps.length; i++) {
        state.currentStep = i;
        await steps[i].action();
        state.completedSteps.push(steps[i].name);
        await this.persistState(state);
      }
      state.status = 'completed';
    } catch (err) {
      state.status = 'compensating';
      await this.compensate(steps, state.completedSteps);
      state.status = 'failed';
      throw err;
    } finally {
      await this.persistState(state);
    }
  }

  private async compensate(steps: SagaStep[], completed: string[]) {
    // 逆序补偿
    for (const stepName of completed.reverse()) {
      const step = steps.find((s) => s.name === stepName);
      if (step) {
        try {
          await step.compensate();
        } catch (err) {
          // 补偿失败，需人工介入
          console.error(`Compensation failed for ${stepName}:`, err);
          await this.alertManualIntervention(stepName);
        }
      }
    }
  }

  private async persistState(state: SagaState) {
    // 持久化到数据库或 Redis
    await redis.setex(`saga:${state.id}`, 86400, JSON.stringify(state));
  }

  private async alertManualIntervention(stepName: string) {
    // 发送告警
  }
}
```

### 电商下单 Saga 示例

```ts
// order-saga.ts
const orderSaga = new SagaOrchestrator();

async function createOrderSaga(orderData: any) {
  const sagaId = crypto.randomUUID();
  const steps: SagaStep[] = [
    {
      name: 'create_order',
      action: async () => {
        await orderService.create(sagaId, orderData);
      },
      compensate: async () => {
        await orderService.cancel(sagaId);
      },
    },
    {
      name: 'reserve_inventory',
      action: async () => {
        await inventoryService.reserve(sagaId, orderData.items);
      },
      compensate: async () => {
        await inventoryService.release(sagaId);
      },
    },
    {
      name: 'process_payment',
      action: async () => {
        await paymentService.charge(sagaId, orderData.amount);
      },
      compensate: async () => {
        await paymentService.refund(sagaId);
      },
    },
    {
      name: 'confirm_order',
      action: async () => {
        await orderService.confirm(sagaId);
      },
      compensate: async () => {
        // 确认后通常不需要补偿，或发送取消通知
      },
    },
  ];

  return orderSaga.execute(sagaId, steps);
}
```

### 编排式 Saga（事件驱动）

```ts
// choreography-saga.ts
// 订单服务创建订单后发事件
async function onOrderCreated(event: OrderCreatedEvent) {
  try {
    await inventoryService.reserve(event.sagaId, event.items);
    eventBus.publish('inventory:reserved', { sagaId: event.sagaId });
  } catch {
    eventBus.publish('inventory:failed', { sagaId: event.sagaId });
  }
}

// 库存服务预留成功
async function onInventoryReserved(event: InventoryReservedEvent) {
  try {
    await paymentService.charge(event.sagaId, event.amount);
    eventBus.publish('payment:success', { sagaId: event.sagaId });
  } catch {
    eventBus.publish('payment:failed', { sagaId: event.sagaId });
    // 库存服务监听 payment:failed 自动释放库存
  }
}
```

## Saga 设计原则

1. **补偿必须幂等**：同一补偿操作执行多次结果不变。
2. **补偿可能失败**：需记录日志并告警人工介入。
3. **隔离性**：Saga 执行期间，中间状态对外可见，需业务容忍。
4. **可观测**：每个步骤的状态变更必须记录和监控。
