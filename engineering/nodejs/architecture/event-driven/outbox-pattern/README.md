# Outbox Pattern

Outbox 模式解决"数据库事务提交成功但消息发送失败"的原子性问题。

## 问题场景

```
[DB Transaction]          [Message Broker]
    |                           |
    v                           v
 写订单表                    发消息（网络失败）
    |                           |
    +---- 事务提交 -------------+
                                |
                                +---- ❌ 消息丢失
```

## Outbox 解决方案

```
[DB Transaction]
    |
    +-- 写业务表
    +-- 写 outbox 表（同一事务）
    |
    v
 事务提交（原子性保证）
    |
    v
[Message Relay] 定时轮询 outbox 表
    |
    v
[Message Broker]
    |
    v
[Consumers]
```

## 核心实现

### 1. Outbox 表

```sql
CREATE TABLE outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(255) NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_status_created ON outbox(status, created_at);
```

### 2. 业务操作 + Outbox 写入

```ts
// order.service.ts
async function placeOrder(data: CreateOrderInput) {
  return prisma.$transaction(async (tx) => {
    // 1. 业务操作
    const order = await tx.order.create({ data });

    // 2. 写入 outbox（同一事务）
    await tx.outbox.create({
      data: {
        aggregateType: 'order',
        aggregateId: order.id,
        eventType: 'OrderPlaced',
        payload: {
          orderId: order.id,
          userId: order.userId,
          total: order.total,
          items: order.items,
        },
        headers: {
          correlationId: crypto.randomUUID(),
          traceId: getTraceId(),
        },
      },
    });

    return order;
  });
}
```

### 3. Message Relay

```ts
// outbox.relay.ts
import { Kafka } from 'kafkajs';

const kafka = new Kafka({ brokers: process.env.KAFKA_BROKERS!.split(',') });
const producer = kafka.producer();

export class OutboxRelay {
  private running = false;

  async start() {
    this.running = true;
    await producer.connect();

    while (this.running) {
      await this.processBatch();
      await new Promise((r) => setTimeout(r, 1000)); // 1s 轮询间隔
    }
  }

  private async processBatch() {
    const messages = await prisma.outbox.findMany({
      where: { status: 'pending', retryCount: { lt: 5 } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    for (const msg of messages) {
      try {
        await producer.send({
          topic: msg.eventType.toLowerCase().replace(/:/g, '-'),
          messages: [
            {
              key: msg.aggregateId,
              value: JSON.stringify(msg.payload),
              headers: msg.headers as any,
            },
          ],
        });

        await prisma.outbox.update({
          where: { id: msg.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      } catch (err) {
        await prisma.outbox.update({
          where: { id: msg.id },
          data: { retryCount: { increment: 1 } },
        });
        console.error(`Failed to relay message ${msg.id}:`, err);
      }
    }
  }

  stop() {
    this.running = false;
  }
}
```

### 4. 有序性保证

如果需要保证同一 aggregate 的事件有序：

```ts
// 使用 Kafka Partition Key
await producer.send({
  topic: 'order-events',
  messages: [{
    key: msg.aggregateId, // 同一 aggregateId 进入同一 partition
    value: JSON.stringify(msg.payload),
  }],
});
```

## Outbox vs Transactional Outbox

| 维度 | 本地 Outbox | Transactional Outbox（Debezium） |
| --- | --- | --- |
| Relay | 轮询 | CDC（数据库 binlog） |
| 延迟 | 秒级 | 毫秒级 |
| 复杂度 | 低 | 高（需 Kafka Connect） |
| 适用 | 大多数场景 | 对延迟极敏感 |

## 注意事项

- Outbox 表定期清理已发送消息（保留 7 天用于审计）。
- 消息消费者必须幂等（防止 relay 重试导致重复投递）。
- 监控 outbox 堆积量和 relay 延迟。
