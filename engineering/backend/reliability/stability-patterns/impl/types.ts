/**
 * Retry
 */
export interface RetryOptions {
  maxAttempts: number;
  // 返回第n次重试前的等待毫秒数，n从1开始
  backoff: (attempt: number) => number;
  retryable?: (e: Error) => boolean;
  onRetry?: (e: Error, attempt: number) => void;
}

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  /** 连续失败次数达到阈值后熔断 */
  failureThreshold: number;
  /** open 状态持续多久后进入 half-open（毫秒） */
  resetTimeoutMs: number;
}
