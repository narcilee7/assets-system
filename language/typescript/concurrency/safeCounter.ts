/**
 * 手写线程安全计数器（单进程内）
 *
 * 考点：
 * - JavaScript 单线程，但异步并发仍会导致竞态（read-modify-write）。
 * - 用 async mutex 保护临界区。
 */

export class SafeCounter {
  private value = 0;
  private queue: Array<() => void> = [];
  private locked = false;

  async increment(delta = 1): Promise<number> {
    return this.runExclusive(() => {
      this.value += delta;
      return this.value;
    });
  }

  get(): number {
    return this.value;
  }

  private async runExclusive<T>(fn: () => T): Promise<T> {
    await this.acquire();
    try {
      return fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    const counter = new SafeCounter();
    await Promise.all(Array.from({ length: 1000 }, () => counter.increment()));
    console.log(counter.get()); // 1000
  }
  demo();
}
