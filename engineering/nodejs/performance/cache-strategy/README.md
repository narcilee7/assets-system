# Caching Strategy

缓存是 Node.js 服务性能优化的第一杠杆。正确的缓存策略能将响应时间从 100ms 降至 1ms。

## 缓存层级

| 层级 | 技术 | TTL | 命中率 |
| --- | --- | --- | --- |
| 浏览器 | Cache-Control | 按资源 | 最高 |
| CDN | Cloudflare / Vercel Edge | 按路由 | 高 |
| 应用内存 | LRU / NodeCache | 秒级 | 中高 |
| 分布式缓存 | Redis | 分钟级 | 高 |
| 数据库 | Query Cache / 物化视图 | 持久 | 中 |

## 核心实现

### 1. Cache-Aside 模式

```ts
// cache-aside.ts
import { Redis } from 'ioredis';

const redis = new Redis();

export async function cacheAside<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number = 60,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const value = await factory();
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
  return value;
}
```

### 2. 缓存穿透 / 击穿 / 雪崩防护

```ts
// cache-problems.ts
import { Mutex } from 'async-mutex';

const mutexes = new Map<string, Mutex>();

// 防击穿：互斥锁
export async function getWithMutex<T>(key: string, factory: () => Promise<T>, ttl: number): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const mutex = mutexes.get(key) || new Mutex();
  mutexes.set(key, mutex);

  return mutex.runExclusive(async () => {
    const doubleCheck = await redis.get(key);
    if (doubleCheck) return JSON.parse(doubleCheck);

    const value = await factory();
    await redis.setex(key, ttl, JSON.stringify(value));
    return value;
  });
}

// 防穿透：布隆过滤器或空值缓存
export async function getWithNullCache<T>(
  key: string,
  factory: () => Promise<T | null>,
  ttl: number,
): Promise<T | null> {
  const cached = await redis.get(key);
  if (cached === '__NULL__') return null;
  if (cached) return JSON.parse(cached);

  const value = await factory();
  if (value === null) {
    await redis.setex(key, 30, '__NULL__'); // 短 TTL 空值缓存
  } else {
    await redis.setex(key, ttl, JSON.stringify(value));
  }
  return value;
}

// 防雪崩：随机 TTL
export function jitterTTL(base: number, jitterPercent = 10): number {
  const jitter = base * (jitterPercent / 100) * Math.random();
  return Math.floor(base + jitter);
}
```

### 3. HTTP 缓存头

```ts
// http-cache.ts
import { Request, Response, NextFunction } from 'express';

export function cacheControl(maxAgeSeconds: number, staleWhileRevalidate?: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const directives = [`max-age=${maxAgeSeconds}`];
    if (staleWhileRevalidate) {
      directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }
    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
}
```

## 缓存失效策略

| 策略 | 说明 | 适用 |
| --- | --- | --- |
| TTL | 时间到期自动失效 | 大部分只读数据 |
| Write-Through | 写数据库同时写缓存 | 一致性要求高 |
| Write-Behind | 异步写缓存 | 高吞吐、容忍短暂不一致 |
| Event Invalidation | 监听变更事件删缓存 | 实时性要求高 |

> 推荐：读多用 Cache-Aside + TTL；写多用 Write-Through + 消息队列失效。
