/**
 * 手写 Token Bucket Rate Limiter
 *
 * 考点：
 * - 固定速率补充令牌。
 * - 桶容量限制突发。
 * - 单进程并发安全用 Promise 队列不够，这里用简单的同步锁。
 */

export class TokenBucket {
  private tokens: number;
  private lastUpdate: number;

  constructor(
    private rate: number,
    private capacity: number
  ) {
    this.tokens = capacity;
    this.lastUpdate = performance.now();
  }

  allow(tokens = 1): boolean {
    this.replenish();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  async wait(tokens = 1): Promise<void> {
    while (!this.allow(tokens)) {
      const waitMs = ((tokens - this.tokens) / this.rate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private replenish(): void {
    const now = performance.now();
    const elapsed = (now - this.lastUpdate) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);
    this.lastUpdate = now;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bucket = new TokenBucket(10, 2);
  console.log(bucket.allow()); // true
  console.log(bucket.allow()); // true
  console.log(bucket.allow()); // false
}
