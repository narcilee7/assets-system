# Python Distributed Transactions

Python 中实现分布式事务的方案：TCC、Saga、2PC、本地消息表。

## TCC 模式

```python
# tcc_transaction.py
from dataclasses import dataclass
from typing import Callable, Awaitable, List
import asyncio

@dataclass
class TCCAction:
    try_func: Callable[[], Awaitable[bool]]
    confirm_func: Callable[[], Awaitable[bool]]
    cancel_func: Callable[[], Awaitable[bool]]

class TCCTransaction:
    def __init__(self):
        self.actions: List[TCCAction] = []
    
    def add(self, action: TCCAction):
        self.actions.append(action)
    
    async def execute(self):
        confirmed = []
        try:
            # Try 阶段
            for action in self.actions:
                success = await action.try_func()
                if not success:
                    raise Exception("Try phase failed")
                confirmed.append(action)
            
            # Confirm 阶段
            for action in confirmed:
                await action.confirm_func()
        except Exception:
            # Cancel 阶段
            for action in confirmed:
                try:
                    await action.cancel_func()
                except Exception:
                    pass  # 记录补偿失败日志
            raise

# 使用
async def create_order_tcc():
    tx = TCCTransaction()
    
    tx.add(TCCAction(
        try_func=lambda: inventory_service.try_reserve("SKU-001", 1),
        confirm_func=lambda: inventory_service.confirm_reserve("SKU-001", 1),
        cancel_func=lambda: inventory_service.cancel_reserve("SKU-001", 1),
    ))
    
    tx.add(TCCAction(
        try_func=lambda: payment_service.try_freeze(100),
        confirm_func=lambda: payment_service.confirm_freeze(100),
        cancel_func=lambda: payment_service.cancel_freeze(100),
    ))
    
    await tx.execute()
```

## 本地消息表（最终一致性）

```python
# outbox_pattern.py
from sqlalchemy import Column, Integer, String, JSON, DateTime
from datetime import datetime

class OutboxMessage(Base):
    __tablename__ = 'outbox'
    
    id = Column(Integer, primary_key=True)
    topic = Column(String(255), nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(String(20), default='pending')  # pending, sent, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)

# 业务操作 + 写入消息表（同一事务）
async def create_order(db, order_data):
    async with db.begin():
        order = await Order.create(**order_data)
        await OutboxMessage.create(
            topic='order.created',
            payload={'order_id': order.id, 'amount': order.amount},
        )
        return order

# 后台任务轮询发送
async def outbox_publisher():
    while True:
        messages = await OutboxMessage.filter(status='pending').limit(100)
        for msg in messages:
            try:
                await kafka_producer.send(msg.topic, msg.payload)
                await msg.update(status='sent', sent_at=datetime.utcnow())
            except Exception:
                await msg.update(status='failed')
        await asyncio.sleep(1)
```
