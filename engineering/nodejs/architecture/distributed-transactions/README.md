# Distributed Transactions

微服务架构中，业务操作往往涉及多个服务/数据库，需要保证跨服务的数据一致性。

## CAP 定理

| 特性 | 说明 |
| --- | --- |
| C (Consistency) | 所有节点数据一致 |
| A (Availability) | 每个请求都有响应 |
| P (Partition Tolerance) | 网络分区时系统仍能运行 |

> 网络分区（P）不可避免，所以只能在 C 和 A 之间做取舍。

## 一致性模型

| 模型 | 说明 | 代表 |
| --- | --- | --- |
| 强一致性 | 写入立即可见 | 单机数据库、Raft/Paxos |
| 最终一致性 | 短时间内可能不一致，最终一致 | Cassandra、DynamoDB |
| 因果一致性 | 有因果关系的操作有序 | COPS、MongoDB |
| 读己之写 | 保证自己写入的数据能立即读到 | 大多数 NoSQL |

## 分布式事务方案

### 1. 两阶段提交（2PC）

```
Coordinator                    Participant A                Participant B
    |                               |                             |
    |----- PREPARE ---------------->|                             |
    |----- PREPARE --------------------------------------------->|
    |                               | 写 redo/undo log           |
    |                               | 锁定资源                   |
    |<---- YES ---------------------|                             |
    |<---- YES --------------------------------------------------|
    |                               |                             |
    |----- COMMIT ----------------->|                             |
    |----- COMMIT --------------------------------------------->|
    |                               | 提交                       |
    |                               | 释放锁                     |
    |<---- ACK ---------------------|                             |
    |<---- ACK --------------------------------------------------|
```

**缺点**：协调者单点故障、阻塞（参与者锁定资源等待）、性能差。

### 2. TCC（Try-Confirm-Cancel）

```ts
// tcc-pattern.ts
interface TCCParticipant {
  try(): Promise<boolean>;
  confirm(): Promise<void>;
  cancel(): Promise<void>;
}

class OrderTCC implements TCCParticipant {
  async try() {
    // 创建订单，状态为 PREPARING，扣减预占库存
    await orderService.createPreparingOrder();
    await inventoryService.reserveStock();
    return true;
  }

  async confirm() {
    // 确认订单，状态改为 PAID
    await orderService.confirmOrder();
    await inventoryService.deductStock();
  }

  async cancel() {
    // 回滚：释放库存，取消订单
    await inventoryService.releaseStock();
    await orderService.cancelOrder();
  }
}

class PaymentTCC implements TCCParticipant {
  async try() {
    // 冻结用户余额
    await paymentService.freezeBalance();
    return true;
  }

  async confirm() {
    // 实际扣款
    await paymentService.deductBalance();
  }

  async cancel() {
    // 解冻余额
    await paymentService.unfreezeBalance();
  }
}

export async function executeTCC(participants: TCCParticipant[]) {
  // Phase 1: Try
  const completed: TCCParticipant[] = [];
  try {
    for (const p of participants) {
      const ok = await p.try();
      if (!ok) throw new Error('Try failed');
      completed.push(p);
    }
  } catch (err) {
    // Phase 1 失败，Cancel 所有已完成的
    for (const p of completed.reverse()) {
      await p.cancel().catch(console.error);
    }
    throw err;
  }

  // Phase 2: Confirm
  for (const p of participants) {
    await p.confirm().catch(async (err) => {
      // Confirm 失败，需人工介入或重试
      console.error('Confirm failed, need manual intervention:', err);
    });
  }
}
```

### 3. Saga 模式（见 `../saga-pattern`）

### 4. 本地消息表（最终一致性）

```ts
// local-message-table.ts
// 在同一数据库事务中：执行业务操作 + 写入消息表
async function placeOrder(data: any) {
  return db.transaction(async (trx) => {
    // 1. 业务操作
    const order = await trx('orders').insert(data).returning('*');

    // 2. 写入消息表（同一事务）
    await trx('outbox').insert({
      topic: 'order:created',
      payload: JSON.stringify(order),
      status: 'pending',
      created_at: new Date(),
    });

    return order;
  });
}

// 定时任务扫描消息表，发送到消息队列
async function relayMessages() {
  const messages = await db('outbox')
    .where({ status: 'pending' })
    .limit(100);

  for (const msg of messages) {
    try {
      await kafka.producer.send({
        topic: msg.topic,
        messages: [{ value: msg.payload }],
      });
      await db('outbox').where({ id: msg.id }).update({ status: 'sent' });
    } catch (err) {
      console.error('Relay failed:', err);
      // 下次定时任务重试
    }
  }
}
```

## 选型建议

| 场景 | 方案 |
| --- | --- |
| 强一致性、短事务 | 2PC / XA |
| 长事务、高并发 | TCC |
| 最终一致、异步 | Saga + 补偿 |
| 最终一致、简单 | 本地消息表 / Outbox |
