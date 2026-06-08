# NATS Messaging

NATS 是一个轻量、高性能的云原生消息系统，支持 Pub/Sub、Request/Reply、JetStream 持久化。

## 特点

- 纯 Go 编写，单个二进制文件
- 支持多种模式：Core NATS（纯内存）、JetStream（持久化）、Key-Value、Object Store
- 自带服务发现（无需额外注册中心）
- 支持 WebSocket 和 MQTT 协议

## 核心实现

```ts
// nats-client.ts
import { connect, JSONCodec, NatsConnection, JetStreamClient, JetStreamManager } from 'nats';

const jc = JSONCodec();
let nc: NatsConnection;
let js: JetStreamClient;
let jsm: JetStreamManager;

export async function initNATS(url: string = process.env.NATS_URL!) {
  nc = await connect({ servers: url });
  js = nc.jetstream();
  jsm = await nc.jetstreamManager();
  console.log('Connected to NATS:', nc.getServer());
  return { nc, js, jsm };
}

export { jc, nc, js, jsm };
```

### 1. Pub/Sub

```ts
// pubsub.ts
import { nc, jc } from './nats-client';

// Publisher
export async function publishEvent(subject: string, data: any) {
  nc.publish(subject, jc.encode(data));
}

// Subscriber
export async function subscribe(subject: string, handler: (data: any) => Promise<void>) {
  const sub = nc.subscribe(subject);
  (async () => {
    for await (const msg of sub) {
      try {
        const data = jc.decode(msg.data);
        await handler(data);
        msg.respond(jc.encode({ status: 'ok' })); // Reply（可选）
      } catch (err) {
        console.error('Handler error:', err);
      }
    }
  })();
  return sub;
}
```

### 2. JetStream（持久化队列）

```ts
// jetstream.ts
import { js, jsm, jc } from './nats-client';

export async function setupStream(name: string, subjects: string[]) {
  try {
    await jsm.streams.add({
      name,
      subjects,
      retention: 'limits', // 'limits' | 'interest' | 'workqueue'
      max_msgs: 100_000,
      max_bytes: 1024 * 1024 * 1024, // 1GB
      max_age: 24 * 60 * 60 * 1_000_000_000, // 1 day in nanoseconds
    });
  } catch {
    // Stream 已存在
  }
}

// 发布到 JetStream
export async function publishToStream(stream: string, subject: string, data: any) {
  await js.publish(subject, jc.encode(data));
}

// 消费 JetStream
export async function consumeStream(stream: string, durableName: string, handler: (data: any) => Promise<void>) {
  const consumer = await js.consumers.get(stream, durableName);
  const messages = await consumer.consume();

  (async () => {
    for await (const msg of messages) {
      try {
        const data = jc.decode(msg.data);
        await handler(data);
        await msg.ack();
      } catch (err) {
        console.error('Processing error:', err);
        await msg.nak(5000); // 5s 后重试
      }
    }
  })();
}
```

### 3. Request/Reply（RPC 模式）

```ts
// rpc.ts
import { nc, jc } from './nats-client';

// 服务端
export async function setupRPC(service: string, handler: (req: any) => Promise<any>) {
  const sub = nc.subscribe(service);
  (async () => {
    for await (const msg of sub) {
      const req = jc.decode(msg.data);
      const res = await handler(req);
      if (msg.respond) {
        msg.respond(jc.encode(res));
      }
    }
  })();
}

// 客户端
export async function callRPC(service: string, request: any, timeout = 5000): Promise<any> {
  const res = await nc.request(service, jc.encode(request), { timeout });
  return jc.decode(res.data);
}
```

## NATS vs RabbitMQ vs Kafka

| 维度 | NATS | RabbitMQ | Kafka |
| --- | --- | --- | --- |
| 部署 | 极简单一二进制 | Erlang/OTP | ZooKeeper/KRaft |
| 性能 | 极高（百万 msg/s） | 高（十万 msg/s） | 极高（百万 msg/s） |
| 持久化 | JetStream 可选 | 默认持久化 | 默认持久化 |
| 功能 | 轻量、云原生 | 丰富路由 | 大数据流 |
| 适用 | 微服务通信、IoT | 企业消息 | 事件溯源、日志 |
