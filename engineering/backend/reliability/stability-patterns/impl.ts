/**
 * 稳定性三件套：Retry + Timeout + Circuit Breaker。
 *
 * 考点：
 * - 退避策略：指数退避 + jitter，避免惊群
 * - 超时控制：单 attempt 超时 vs 总超时
 * - 熔断状态机：closed → open → half-open → closed
 * - 组合顺序：CB 在最外层，retry 包 timeout，每次重试独立计时
 */

/* ------------------------------------------------------------------ */
/*  Retry                                                             */
/* ------------------------------------------------------------------ */

export interface RetryOptions {
  maxAttempts: number;
  /** 返回第 n 次重试前的等待毫秒数，n 从 1 开始 */
  backoff: (attempt: number) => number;
  /** 判断错误是否可重试，默认全部可重试 */
  retryable?: (error: Error) => boolean;
  /** 每次重试前的回调 */
  onRetry?: (error: Error, attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, backoff, retryable = () => true, onRetry } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (!retryable(lastError)) {
        throw lastError;
      }

      if (attempt === maxAttempts) {
        break;
      }

      if (onRetry) {
        onRetry(lastError, attempt);
      }

      const delay = backoff(attempt);
      await sleep(delay);
    }
  }

  throw lastError!;
}

/* ------------------------------------------------------------------ */
/*  Timeout                                                           */
/* ------------------------------------------------------------------ */

export class TimeoutError extends Error {
  constructor(message: string, public readonly ms: number) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new Error("Aborted"));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new TimeoutError(`Operation timed out after ${ms}ms`, ms));
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(signal!.reason ?? new Error("Aborted"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (reason) => {
        cleanup();
        reject(reason);
      }
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Circuit Breaker                                                   */
/* ------------------------------------------------------------------ */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  /** 连续失败次数达到阈值后熔断 */
  failureThreshold: number;
  /** open 状态持续多久后进入 half-open（毫秒） */
  resetTimeoutMs: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenInProgress = false;

  constructor(private options: CircuitBreakerOptions) {}

  getState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = "half-open";
        this.failures = 0;
      } else {
        throw new CircuitBreakerError("Circuit breaker is OPEN");
      }
    }

    if (this.state === "half-open" && this.halfOpenInProgress) {
      throw new CircuitBreakerError(
        "Circuit breaker is HALF-OPEN, probe in progress"
      );
    }

    if (this.state === "half-open") {
      this.halfOpenInProgress = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    if (this.state === "half-open") {
      this.halfOpenInProgress = false;
    }
    this.state = "closed";
    this.failures = 0;
  }

  private onFailure() {
    if (this.state === "half-open") {
      this.halfOpenInProgress = false;
      this.state = "open";
      this.lastFailureTime = Date.now();
      return;
    }

    this.failures += 1;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = "open";
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 指数退避：base * 2^(attempt-1)，可配 maxMs 上限 */
export function exponentialBackoff(
  baseMs: number,
  maxMs = 30000
): (attempt: number) => number {
  return (attempt: number) => {
    const jitter = Math.random() * 0.3 * baseMs; // 30% jitter
    const delay = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs) + jitter;
    return Math.floor(delay);
  };
}

/* ------------------------------------------------------------------ */
/*  Composition                                                       */
/* ------------------------------------------------------------------ */

export interface StabilityOptions {
  /** 单次 attempt 的超时 */
  perAttemptTimeoutMs: number;
  retry: RetryOptions;
  circuitBreaker: CircuitBreaker;
}

/**
 * 推荐组合顺序：
 * CircuitBreaker -> Retry -> Timeout(per-attempt) -> Business
 *
 * 这样每次重试都有独立的超时，熔断器监控的是"重试后的最终结果"。
 */
export function withStability<T>(
  fn: () => Promise<T>,
  options: StabilityOptions
): Promise<T> {
  const { circuitBreaker, retry, perAttemptTimeoutMs } = options;

  return circuitBreaker.execute(() =>
    withRetry(
      () => withTimeout(fn(), perAttemptTimeoutMs),
      retry
    )
  );
}
