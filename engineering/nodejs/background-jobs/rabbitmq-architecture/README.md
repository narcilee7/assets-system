# RabbitMQ Message Architecture

RabbitMQ 是功能最丰富的消息中间件，支持多种消息模式：Work Queue、Pub/Sub、Routing、RPC。

## 核心概念

| 概念 | 说明 |
| --- | --- |
| Exchange | 消息路由入口，决定消息分发到哪个 Queue |
| Queue | 消息存储容器 |
| Binding | Exchange 和 Queue 的绑定关系 |
| Routing Key | 消息路由标识 |

## Exchange 类型

| 类型 | 行为 |
| --- | --- |
| direct | 精确匹配 Routing Key |
| fanout | 广播到所有绑定的 Queue |
| topic | 模式匹配（`order.*`、`payment.#`） |
| headers | 根据 Header 匹配 |

## 核心实现

```ts
// rabbitmq-client.ts
import amqp from 'amqplib';

class RabbitMQClient {
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;

  async connect(url: string = process.env.RABBITMQ_URL!) {
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
    return this;
  }

  async publish(exchange: string, routingKey: string, message: any, options?: amqp.Options.Publish) {
    if (!this.channel) throw new Error('Not connected');
    const buffer = Buffer.from(JSON.stringify(message));
    return this.channel.publish(exchange, routingKey, buffer, {
      persistent: true,
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
      ...options,
    });
  }

  async consume(queue: string, handler: (msg: amqp.ConsumeMessage) => Promise<void>, options?: amqp.Options.Consume) {
    if (!this.channel) throw new Error('Not connected');
    await this.channel.prefetch(10); // QoS
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        await handler(msg);
        this.channel!.ack(msg);
      } catch (err) {
        // 重试次数检查
        const retries = (msg.properties.headers?.['x-retries'] || 0) + 1;
        if (retries > 3) {
          this.channel!.nack(msg, false, false); // 进入死信队列
        } else {
          this.channel!.nack(msg, false, true); // 重新入队
        }
      }
    }, options);
  }

  async close() {
    await this.channel?.close();
    await this.connection?.close();
  }
}

export const rabbitmq = new RabbitMQClient();
```

### 1. Work Queue（任务分发）

```ts
// work-queue.ts
async function setupWorkQueue() {
  const ch = rabbitmq['channel']!;
  await ch.assertQueue('task_queue', { durable: true });
  await ch.prefetch(1); // 公平分发
}

// Producer
await rabbitmq.publish('', 'task_queue', { task: 'heavy-computation', data: {} });

// Consumer
await rabbitmq.consume('task_queue', async (msg) => {
  const data = JSON.parse(msg.content.toString());
  await processTask(data);
});
```

### 2. Pub/Sub（事件广播）

```ts
// pubsub.ts
async function setupPubSub() {
  const ch = rabbitmq['channel']!;
  await ch.assertExchange('events', 'fanout', { durable: true });
  const { queue } = await ch.assertQueue('', { exclusive: true }); // 临时队列
  await ch.bindQueue(queue, 'events', '');
  return queue;
}

// Publisher
await rabbitmq.publish('events', '', { type: 'user:created', userId: '123' });

// Subscriber
const queue = await setupPubSub();
await rabbitmq.consume(queue, async (msg) => {
  const event = JSON.parse(msg.content.toString());
  console.log('Received event:', event.type);
});
```

### 3. Topic Routing（日志分级）

```ts
// topic-routing.ts
async function setupTopicRouting() {
  const ch = rabbitmq['channel']!;
  await ch.assertExchange('logs', 'topic', { durable: true });

  // 绑定：只接收 order 模块的 error 级别日志
  await ch.assertQueue('order_errors');
  await ch.bindQueue('order_errors', 'logs', 'order.error.*');

  // 绑定：接收所有模块的 critical 日志
  await ch.assertQueue('critical_logs');
  await ch.bindQueue('critical_logs', 'logs', '*.critical.*');
}

// 发送
await rabbitmq.publish('logs', 'order.error.payment-failed', { message: '...' });
```

### 4. 死信队列（DLQ）

```ts
// dead-letter-queue.ts
async function setupDLQ() {
  const ch = rabbitmq['channel']!;

  await ch.assertExchange('dlx', 'direct', { durable: true });
  await ch.assertQueue('dlq', { durable: true });
  await ch.bindQueue('dlq', 'dlx', 'failed');

  await ch.assertQueue('main_queue', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx',
      'x-dead-letter-routing-key': 'failed',
      'x-message-ttl': 30000, // 30s 未消费也进 DLQ
    },
  });
}
```

## RabbitMQ vs BullMQ vs Kafka

| 维度 | RabbitMQ | BullMQ | Kafka |
| --- | --- | --- | --- |
| 协议 | AMQP | Redis List/Stream | 自定义协议 |
| 路由能力 | 极强（Exchange） | 弱（仅队列名） | 中等（Topic Partition） |
| 持久化 | 磁盘 | Redis 内存/AOF | 磁盘（高吞吐） |
| 消费模式 | Push | Pull/Push | Pull |
| 顺序保证 | Queue 级别 | Job 级别 | Partition 级别 |
| 适用 | 复杂路由、RPC | 简单任务队列 | 大数据流、事件溯源 |
