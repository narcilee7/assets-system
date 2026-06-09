# MongoDB Change Streams

Change Streams 是 MongoDB 3.6+ 提供的实时变更通知机制，基于 oplog，无需轮询。

## 核心场景

- 实时数据同步（MongoDB → Elasticsearch / Redis / 消息队列）
- 缓存失效（数据变更时清除缓存）
- 事件驱动架构（数据库即事件源）
- 实时分析（流式处理变更）

## 核心实现

```ts
// change-stream.service.ts
import { ChangeStream, Db } from 'mongodb';

export class ChangeStreamService {
  private streams: ChangeStream[] = [];

  async watchOrders(db: Db) {
    const pipeline = [
      {
        $match: {
          'fullDocument.status': 'paid',
          operationType: { $in: ['insert', 'update'] },
        },
      },
    ];

    const stream = db.collection('orders').watch(pipeline, {
      fullDocument: 'updateLookup',
      resumeAfter: undefined, // 可传入上次 _id 断点续传
    });

    this.streams.push(stream);

    stream.on('change', (change) => {
      console.log('Order changed:', {
        operation: change.operationType,
        documentId: change.documentKey._id,
        fullDocument: change.fullDocument,
      });

      // 1. 同步到 Elasticsearch
      // elasticsearch.index(change.fullDocument);

      // 2. 清除缓存
      // redis.del(`order:${change.documentKey._id}`);

      // 3. 发送到消息队列
      // kafka.producer.send({ topic: 'order-events', messages: [{ value: JSON.stringify(change) }] });
    });

    stream.on('error', (err) => {
      console.error('Change stream error:', err);
      // 实现自动重连
      setTimeout(() => this.watchOrders(db), 5000);
    });
  }

  async stop() {
    for (const stream of this.streams) {
      await stream.close();
    }
  }
}
```

## Resume Token 与断点续传

```ts
// resume-token-manager.ts
import { Redis } from 'ioredis';

const redis = new Redis();
const TOKEN_KEY = 'mongo:change_stream:resume_token';

export async function saveResumeToken(token: any) {
  await redis.set(TOKEN_KEY, JSON.stringify(token));
}

export async function loadResumeToken(): Promise<any> {
  const data = await redis.get(TOKEN_KEY);
  return data ? JSON.parse(data) : undefined;
}
```

## 限制与注意

- Change Streams 要求 MongoDB 为副本集或分片集群（单节点需配置 `--replSet`）。
- 每个 Change Stream 打开一个游标，消耗连接资源。
- oplog 大小有限（默认磁盘 5%），消费慢可能导致事件丢失（需 Resume Token）。
- `fullDocument: 'updateLookup'` 在更新时能获取完整文档，但有额外查询开销。
