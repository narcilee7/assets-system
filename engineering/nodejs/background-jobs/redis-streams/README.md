# Redis Streams

Redis 5.0+ 引入 Streams 数据类型，为 Redis 增加了持久化、有序、可追溯的消息队列能力。

## 特点

- 内置 Redis，无需额外中间件
- 支持消费者组（Consumer Group）
- 消息持久化（基于 RDB/AOF）
- 支持消息 ID 范围查询和阻塞读取

## 核心实现

```ts
// redis-streams.ts
import { Redis } from 'ioredis';

const redis = new Redis();

// 生产者
export async function produceMessage(stream: string, data: any) {
  return redis.xadd(stream, '*', 'data', JSON.stringify(data));
  // 返回消息 ID，如 "1704067200000-0"
}

// 消费者组消费
export async function consumeStreamGroup(
  stream: string,
  group: string,
  consumer: string,
  handler: (id: string, data: any) => Promise<void>,
) {
  // 创建消费者组（如果不存在）
  try {
    await redis.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
  } catch (err: any) {
    if (!err.message.includes('already exists')) throw err;
  }

  while (true) {
    const results = await redis.xreadgroup(
      'GROUP', group, consumer,
      'COUNT', 10,
      'BLOCK', 5000,
      'STREAMS', stream, '>'
    );

    if (!results) continue;

    for (const [, messages] of results as any) {
      for (const [id, fields] of messages) {
        try {
          const data = JSON.parse(fields[1]);
          await handler(id, data);
          await redis.xack(stream, group, id);
        } catch (err) {
          console.error('Processing failed:', id, err);
          // 可加入死信处理：XADD stream:dlq ...
        }
      }
    }
  }
}

// 获取待处理消息（Pending）
export async function getPendingMessages(stream: string, group: string) {
  return redis.xpending(stream, group);
}

// 认领超时消息（处理消费者崩溃后的消息）
export async function claimPendingMessages(
  stream: string,
  group: string,
  consumer: string,
  minIdleTime: number = 60_000,
) {
  const pending = await redis.xpending(stream, group, '-', '+', 100);
  const ids = pending
    .filter((p: any) => p[2] > minIdleTime) // idle time > minIdleTime
    .map((p: any) => p[0]);

  if (ids.length) {
    await redis.xclaim(stream, group, consumer, minIdleTime, ...ids);
  }
  return ids;
}
```

## Redis Streams vs List（LPUSH/BRPOP）

| 维度 | Streams | List |
| --- | --- | --- |
| 持久化 | 是（AOF/RDB） | 是 |
| 消费者组 | 原生支持 | 需自己实现 |
| 消息追溯 | 支持按 ID 查询 | 不支持 |
| 复杂度 | 中 | 低 |
| 适用 | 可靠消息队列 | 简单任务队列 |

> Streams 适合需要消费者组和消息追溯的场景；简单任务队列用 List 更轻量。
