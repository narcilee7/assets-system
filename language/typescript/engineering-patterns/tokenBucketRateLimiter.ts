/**
 * 手写 token bucket rate limiter
 *
 * 考点：
 * - 单进程并发安全。
 * - 按客户端限流。
 */

import { TokenBucket } from "../concurrency/rateLimiter.js";

export class PerClientLimiter {
  private limiters = new Map<string, TokenBucket>();

  constructor(
    private rate: number,
    private capacity: number
  ) {}

  getLimiter(clientId: string): TokenBucket {
    if (!this.limiters.has(clientId)) {
      this.limiters.set(clientId, new TokenBucket(this.rate, this.capacity));
    }
    return this.limiters.get(clientId)!;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const limiter = new PerClientLimiter(5, 5);
  console.log(limiter.getLimiter("user-1").allow());
  console.log(limiter.getLimiter("user-2").allow());
}
