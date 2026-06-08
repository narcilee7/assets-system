# Distributed Lock

分布式锁用于协调分布式系统中多个进程对共享资源的访问。

## 核心要求

| 特性 | 说明 |
| --- | --- |
| 互斥性 | 同一时刻只有一个客户端持有锁 |
| 防死锁 | 锁必须有过期时间，防止持有者崩溃导致死锁 |
| 可重入 | 同一线程可多次获取同一锁 |
| 高可用 | 锁服务本身不能是单点故障 |

## Redis 分布式锁（Redlock）

### 1. 基础实现（SET NX EX）

```ts
// redis-lock.ts
import { Redis } from 'ioredis';

const redis = new Redis();

export class RedisLock {
  async acquire(lockKey: string, ttlSeconds: number = 30): Promise<string | null> {
    const token = crypto.randomUUID();
    const result = await redis.set(lockKey, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? token : null;
  }

  async release(lockKey: string, token: string): Promise<boolean> {
    // Lua 脚本保证原子性：只有持有锁的客户端才能释放
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await redis.eval(script, 1, lockKey, token);
    return result === 1;
  }

  async extend(lockKey: string, token: string, additionalSeconds: number): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await redis.eval(script, 1, lockKey, token, additionalSeconds);
    return result === 1;
  }
}
```

### 2. Redlock（多 Redis 实例）

```ts
// redlock.ts
import Redlock from 'redlock';
import { Redis } from 'ioredis';

const redisA = new Redis({ host: 'redis1' });
const redisB = new Redis({ host: 'redis2' });
const redisC = new Redis({ host: 'redis3' });

const redlock = new Redlock([redisA, redisB, redisC], {
  driftFactor: 0.01,
  retryCount: 10,
  retryDelay: 200,
  retryJitter: 200,
});

export async function withDistributedLock<T>(
  resource: string,
  ttl: number,
  fn: () => Promise<T>,
): Promise<T> {
  const lock = await redlock.acquire([resource], ttl);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
```

### 3. 看门狗自动续期

```ts
// watchdog-lock.ts
export class WatchdogLock {
  private watchdogTimer?: NodeJS.Timeout;

  async acquireWithWatchdog(lockKey: string, token: string, ttlSeconds: number = 30) {
    const acquired = await this.acquire(lockKey, ttlSeconds);
    if (!acquired) return false;

    // 看门狗：每 ttl/3 续期一次
    this.watchdogTimer = setInterval(async () => {
      const extended = await this.extend(lockKey, token, ttlSeconds);
      if (!extended) {
        this.stopWatchdog();
      }
    }, (ttlSeconds * 1000) / 3);

    return true;
  }

  async release(lockKey: string, token: string) {
    this.stopWatchdog();
    return super.release(lockKey, token);
  }

  private stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = undefined;
    }
  }
}
```

## 使用 redlock 库（生产推荐）

```ts
import Client from 'ioredis';
import Redlock from 'redlock';

const redis = new Client();
const redlock = new Redlock([redis], { retryCount: 3 });

const lock = await redlock.acquire(['resource:order:123'], 5000);
try {
  await processOrder('123');
} finally {
  await lock.release();
}
```

## 分布式锁 vs 数据库乐观锁

| 场景 | 推荐方案 |
| --- | --- |
| 跨服务协调 | Redis Redlock |
| 同数据库事务内 | 悲观锁（SELECT FOR UPDATE） |
| 低并发、简单场景 | 乐观锁（版本号） |
| 需要公平排队 | ZooKeeper / etcd |
