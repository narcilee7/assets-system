# Retry & Bulkhead（重试与舱壁）

重试和舱壁是分布式系统弹性的另外两根支柱。

## 重试策略

### 1. 指数退避 + 抖动

```ts
// retry.ts
interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      if (attempt === options.maxRetries) break;

      // 非可重试错误直接抛出
      if (options.retryableErrors && !options.retryableErrors.includes(err.code)) {
        throw err;
      }

      // 指数退避 + 全抖动
      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt) + Math.random() * options.baseDelayMs,
        options.maxDelayMs,
      );

      console.log(`Retry ${attempt + 1}/${options.maxRetries} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError!;
}

// 使用
const result = await withRetry(
  () => callExternalAPI(),
  { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000, retryableErrors: ['ECONNRESET', 'ETIMEDOUT'] }
);
```

### 2. 使用 p-retry（推荐）

```ts
import retry from 'p-retry';

const result = await retry(() => fetchData(), {
  retries: 3,
  onFailedAttempt: (error) => {
    console.log(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries remaining.`);
  },
});
```

## 舱壁模式（Bulkhead）

舱壁将资源隔离，防止一个故障耗尽全部资源。

```ts
// bulkhead.ts
import { Semaphore } from 'async-mutex';

class Bulkhead {
  private semaphore: Semaphore;

  constructor(private maxConcurrent: number, private maxQueue: number = 100) {
    this.semaphore = new Semaphore(maxConcurrent);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.semaphore.getValue() <= 0 && this.maxQueue <= 0) {
      throw new Error('Bulkhead capacity exceeded');
    }

    const release = await this.semaphore.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

// 不同服务用不同舱壁
const paymentBulkhead = new Bulkhead(10, 50);
const inventoryBulkhead = new Bulkhead(20, 100);

export async function callPaymentService(fn: () => Promise<any>) {
  return paymentBulkhead.execute(fn);
}
```

## 组合：熔断 + 重试 + 舱壁

```
Request -> Bulkhead -> Circuit Breaker -> Retry -> External Service
              |              |               |
              v              v               v
         并发限制        快速失败         自动恢复
```

```ts
// combined-resilience.ts
async function resilientCall<T>(fn: () => Promise<T>): Promise<T> {
  return bulkhead.execute(async () => {
    return breaker.fire(async () => {
      return withRetry(fn, { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 });
    });
  });
}
```

## 重试反模式

- **不要重试非幂等操作**（如 POST 创建资源）——除非有幂等键。
- **不要在熔断打开时重试**——会浪费资源。
- **不要用固定间隔重试**——会导致 thundering herd。
