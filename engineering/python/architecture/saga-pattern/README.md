# Python Saga Pattern

Saga 模式用于长事务的分布式补偿，Python 可用状态机或工作流引擎实现。

## 编排式 Saga（Orchestration）

```python
# saga_orchestrator.py
from dataclasses import dataclass
from typing import List, Callable, Awaitable
import asyncio

@dataclass
class SagaStep:
    name: str
    action: Callable[[], Awaitable[dict]]
    compensation: Callable[[dict], Awaitable[None]]

class SagaOrchestrator:
    def __init__(self):
        self.steps: List[SagaStep] = []
        self.completed: List[tuple] = []  # (step, result)
    
    def add_step(self, step: SagaStep):
        self.steps.append(step)
    
    async def execute(self):
        for step in self.steps:
            try:
                result = await step.action()
                self.completed.append((step, result))
            except Exception as e:
                # 补偿已完成的步骤（逆序）
                for completed_step, completed_result in reversed(self.completed):
                    try:
                        await completed_step.compensation(completed_result)
                    except Exception as comp_error:
                        print(f"Compensation failed for {completed_step.name}: {comp_error}")
                raise SagaFailedException(f"Step {step.name} failed: {e}")

class SagaFailedException(Exception):
    pass

# 使用
async def create_order_saga():
    saga = SagaOrchestrator()
    
    saga.add_step(SagaStep(
        name="reserve_inventory",
        action=lambda: inventory_service.reserve("SKU-001", 1),
        compensation=lambda result: inventory_service.release(result['reservation_id']),
    ))
    
    saga.add_step(SagaStep(
        name="process_payment",
        action=lambda: payment_service.charge(100),
        compensation=lambda result: payment_service.refund(result['transaction_id']),
    ))
    
    saga.add_step(SagaStep(
        name="create_order",
        action=lambda: order_service.create(),
        compensation=lambda result: order_service.cancel(result['order_id']),
    ))
    
    await saga.execute()
```
