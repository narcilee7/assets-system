/**
 * 手写 retry
 *
 * 考点：
 * - 捕获指定异常后重试。
 * - 支持最大次数、延迟、指数退避、jitter。
 */

export async function retry<T>(
  fn: () => T | Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
    jitter?: number | (() => number);
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 0,
    backoff = 1,
    jitter = 0,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      const jitterValue = typeof jitter === "function" ? jitter() : Math.random() * jitter;
      await new Promise((resolve) => setTimeout(resolve, currentDelay + jitterValue));
      currentDelay *= backoff;
    }
  }

  throw lastError;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("fail");
        return "ok";
      },
      { maxAttempts: 3, delay: 10 }
    );
    console.log(result);
  }
  demo();
}
