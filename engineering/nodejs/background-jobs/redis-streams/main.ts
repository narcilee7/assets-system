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