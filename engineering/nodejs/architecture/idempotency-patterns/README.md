# Idempotency Patterns

幂等性是分布式系统的生命线：同一操作执行多次，结果与执行一次相同。

## 为什么需要幂等性

- 网络超时导致客户端重试
- 消息队列至少一次投递（At-least-once）
- 定时任务重复触发
- 用户重复点击提交按钮

## 幂等键策略

### 1. 客户端生成幂等键

```ts
// client.ts
const idempotencyKey = crypto.randomUUID(); // 或基于业务字段 hash
await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(orderData),
});
```

### 2. 服务端幂等存储

```ts
// idempotency.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

const redis = new Redis();
const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24h

export function idempotencyMiddleware(
  handler: (req: Request, res: Response) => Promise<void>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers['idempotency-key'] as string;
    if (!key) {
      return res.status(400).json({ code: 'MISSING_IDEMPOTENCY_KEY' });
    }

    const lockKey = `idempotency:lock:${key}`;
    const resultKey = `idempotency:result:${key}`;

    // 1. 检查是否已有结果
    const cached = await redis.get(resultKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    // 2. 获取分布式锁（防止并发重复处理）
    const locked = await redis.set(lockKey, '1', 'EX', 60, 'NX');
    if (!locked) {
      return res.status(409).json({ code: 'IDEMPOTENCY_KEY_IN_PROGRESS' });
    }

    try {
      // 3. 执行业务逻辑
      await handler(req, res);

      // 4. 缓存结果
      const result = res.locals.idempotencyResult;
      if (result) {
        await redis.setex(resultKey, IDEMPOTENCY_TTL, JSON.stringify(result));
      }
    } catch (err) {
      await redis.del(lockKey); // 失败释放锁，允许重试
      throw err;
    } finally {
      await redis.del(lockKey);
    }
  };
}
```

### 3. 数据库唯一约束（天然幂等）

```ts
// database-idempotency.ts
// 使用业务唯一键 + INSERT IGNORE / ON CONFLICT
async function createOrderWithIdempotency(orderId: string, data: any) {
  try {
    return await prisma.order.create({
      data: { id: orderId, ...data },
    });
  } catch (err: any) {
    if (err.code === 'P2002') { // Prisma unique constraint
      return prisma.order.findUnique({ where: { id: orderId } });
    }
    throw err;
  }
}
```

### 4. Token Bucket 风格的幂等窗口

```ts
// sliding-window-idempotency.ts
export async function isDuplicate(eventId: string, windowMs: number = 60000): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // 使用 Redis Sorted Set，score 为时间戳
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(`events:${eventId}`, 0, windowStart);
  pipeline.zadd(`events:${eventId}`, now, `${now}-${Math.random()}`);
  pipeline.zcard(`events:${eventId}`);
  pipeline.expire(`events:${eventId}`, Math.ceil(windowMs / 1000));

  const results = await pipeline.exec();
  const count = results?.[2]?.[1] as number;
  return count > 1;
}
```

## 幂等性矩阵

| 操作 | 天然幂等 | 需实现 |
| --- | --- | --- |
| GET | ✅ | 无 |
| PUT（全量替换） | ✅ | 无 |
| DELETE | ✅ | 无 |
| POST（创建） | ❌ | 幂等键 + 唯一约束 |
| PATCH（增量更新） | ❌ | 乐观锁 / 条件更新 |
| 消息消费 | ❌ | 幂等键去重 |
| 定时任务 | ❌ | 分布式锁 + 幂等键 |
