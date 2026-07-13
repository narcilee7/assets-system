/**
 * 手写 async retry
 *
 * 考点：
 * - 异步函数重试。
 * - 支持 AbortSignal 取消。
 */

export async function asyncRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
    signal?: AbortSignal;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 0, backoff = 1, signal, shouldRetry = () => true } = options;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw signal.reason;
    try {
      return await fn(signal);
    } catch (error) {
      if (attempt === maxAttempts || !shouldRetry(error) || signal?.aborted) {
        throw error;
      }
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, currentDelay);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason);
        }, { once: true });
      });
      currentDelay *= backoff;
    }
  }
  throw new Error("unreachable");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    let attempts = 0;
    const result = await asyncRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error("fail");
      return "ok";
    }, { maxAttempts: 3, delay: 10 });
    console.log(result);
  }
  demo();
}
