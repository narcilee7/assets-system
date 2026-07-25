/**
 * 手写 retry with backoff（工程版）
 *
 * 考点：
 * - 策略对象封装重试逻辑。
 * - 支持 sync / async。
 */

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: number;
  maxDelay?: number;
  jitter?: number | (() => number);
  shouldRetry?: (error: unknown) => boolean;
}

export class RetryPolicy {
  constructor(private options: RetryOptions = {}) {}

  async run<T>(fn: () => T | Promise<T>): Promise<T> {
    const {
      maxAttempts = 3,
      delay = 0,
      backoff = 2,
      maxDelay = Infinity,
      jitter = 0,
      shouldRetry = () => true,
    } = this.options;

    let currentDelay = delay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts || !shouldRetry(error)) throw error;
        const jitterValue = typeof jitter === "function" ? jitter() : Math.random() * jitter;
        await new Promise((resolve) => setTimeout(resolve, Math.min(currentDelay + jitterValue, maxDelay)));
        currentDelay *= backoff;
      }
    }
    throw new Error("unreachable");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    let attempts = 0;
    const policy = new RetryPolicy({ maxAttempts: 3, delay: 10, backoff: 2 });
    const result = await policy.run(() => {
      attempts++;
      if (attempts < 3) throw new Error("fail");
      return "ok";
    });
    console.log(result);
  }
  demo();
}
