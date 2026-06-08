# Kafka Streams with Node.js

Kafka 是高吞吐、持久化的分布式流处理平台，适合事件溯源、实时数据管道和大规模日志处理。

## 核心概念

| 概念 | 说明 |
| --- | --- |
| Topic | 消息主题，逻辑上的消息流 |
| Partition | Topic 的物理分片，保证分区有序 |
| Offset | 消息在 Partition 中的位置 |
| Consumer Group | 一组消费者共同消费一个 Topic |
| Replication | Partition 的副本数，保证高可用 |

## 核心实现

```ts
// kafka-client.ts
import { Kafka, Producer, Consumer, Partitioners } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: process.env.KAFKA_BROKERS!.split(','),
  retry: { initialRetryTime: 300, retries: 5 },
});

export const producer: Producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
  idempotent: true, // 幂等生产者
  transactionalId: 'my-transactional-producer',
});

export async function createConsumer(groupId: string): Promise<Consumer> {
  return kafka.consumer({
    groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });
}
```

### 1. 生产者（带 Key 分区）

```ts
// producer.ts
import { producer } from './kafka-client';

export async function publishOrderEvent(order: any) {
  await producer.send({
    topic: 'orders',
    messages: [
      {
        key: order.userId, // 相同 userId 进入同一 Partition，保证用户内有序
        value: JSON.stringify(order),
        headers: {
          'event-type': 'order:created',
          'version': '1.0',
        },
      },
    ],
  });
}

// 批量发送
export async function publishBatch(events: any[]) {
  await producer.sendBatch({
    topicMessages: [
      {
        topic: 'orders',
        messages: events.map((e) => ({
          key: e.userId,
          value: JSON.stringify(e),
        })),
      },
    ],
  });
}
```

### 2. 消费者（手动提交 Offset）

```ts
// consumer.ts
import { createConsumer } from './kafka-client';

export async function startOrderConsumer() {
  const consumer = await createConsumer('order-processors');
  await consumer.subscribe({ topic: 'orders', fromBeginning: false });

  await consumer.run({
    autoCommit: false, // 手动提交，确保处理完成后再确认
    eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
      for (const message of batch.messages) {
        const event = JSON.parse(message.value!.toString());
        await processOrderEvent(event);
        resolveOffset(message.offset);
        await heartbeat(); // 防止超时 rebalance
      }
      await commitOffsetsIfNecessary();
    },
  });
}
```

### 3. 事务（Exactly-Once）

```ts
// kafka-transaction.ts
export async function transferBetweenTopics(
  sourceTopic: string,
  targetTopic: string,
  message: any,
) {
  const transaction = await producer.transaction();
  try {
    await transaction.send({
      topic: targetTopic,
      messages: [{ value: JSON.stringify(message) }],
    });
    await transaction.sendOffsets({
      consumerGroupId: 'my-group',
      topics: [{ topic: sourceTopic, partitions: [{ partition: 0, offset: '10' }] }],
    });
    await transaction.commit();
  } catch (err) {
    await transaction.abort();
    throw err;
  }
}
```

## Kafka 分区策略

```ts
// custom-partitioner.ts
export function userPartitioner(partitionCount: number) {
  return (message: { key?: string }) => {
    if (!message.key) return 0;
    // 简单的 hash 分区
    let hash = 0;
    for (const char of message.key) {
      hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    }
    return Math.abs(hash) % partitionCount;
  };
}
```

## 生产 Checklist

- [ ] 设置 `acks: 'all'` 保证数据不丢失。
- [ ] 开启幂等生产者 `idempotent: true`。
- [ ] Consumer Group 数量不超过 Partition 数，否则会有消费者空闲。
- [ ] 监控 `consumer_lag`，滞后过大需扩容消费者或增加 Partition。
- [ ] 使用 Schema Registry（Confluent / AWS Glue）管理消息格式演化。
