# Circuit Breaker（熔断器）

熔断器防止故障级联扩散：当依赖服务持续失败时，快速失败，避免资源耗尽。

## 三种状态

```
CLOSED  ----(失败率>阈值)---->  OPEN
  ^                                |
  |                                | (超时后)
  |----(成功)----  HALF_OPEN  <----|
```

| 状态 | 行为 |
| --- | --- |
| CLOSED | 正常放行请求 |
| OPEN | 直接拒绝请求，快速失败 |
| HALF_OPEN | 放少量请求试探，成功后关闭，失败后重新打开 |

## 核心实现

```ts
// circuit-breaker.ts
interface CircuitBreakerOptions {
  failureThreshold: number;      // 失败次数阈值
  successThreshold: number;      // HALF_OPEN 成功次数阈值
  timeout: number;               // OPEN -> HALF_OPEN 超时（ms）
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();

  constructor(
    private action: (...args: any[]) => Promise<any>,
    private options: CircuitBreakerOptions = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000,
    },
  ) {}

  async execute(...args: any[]): Promise<any> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }

    try {
      const result = await this.action(...args);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure() {
    this.failureCount++;

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.timeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// 使用 opossum 库（生产推荐）
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(callExternalAPI, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

breaker.on('open', () => console.log('Circuit breaker opened'));
breaker.on('halfOpen', () => console.log('Circuit breaker half-open'));
breaker.on('close', () => console.log('Circuit breaker closed'));

export async function fetchData() {
  return breaker.fire();
}
```

## 熔断 + 降级

```ts
// fallback.ts
async function getProductWithFallback(productId: string) {
  try {
    return await breaker.fire(productId);
  } catch (err) {
    // 降级：从缓存读取
    const cached = await redis.get(`product:${productId}`);
    if (cached) return JSON.parse(cached);

    // 兜底：返回默认数据
    return { id: productId, name: 'Product temporarily unavailable', price: 0 };
  }
}
```

## 生产要点

- 熔断阈值需根据业务 SLA 调整，太敏感会误伤，太迟钝会雪崩。
- 熔断触发时通知告警，但不应自动恢复（需人工确认根因）。
- 不同 API 用不同熔断器，避免一个接口故障影响全部。
