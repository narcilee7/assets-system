/**
 * 手写生产者消费者
 *
 * 考点：
 * - 基于 AsyncIterable 解耦生产与消费。
 * - 背压控制：消费者通过 for await 自然反压。
 */

export class AsyncQueue<T> {
  private buffer: T[] = [];
  private resolvers: Array<(value: IteratorResult<T>) => void> = [];
  private done = false;

  push(item: T): void {
    if (this.done) throw new Error("queue is closed");
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve({ value: item, done: false });
    } else {
      this.buffer.push(item);
    }
  }

  close(): void {
    this.done = true;
    for (const resolve of this.resolvers) {
      resolve({ value: undefined as unknown as T, done: true });
    }
    this.resolvers = [];
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    while (true) {
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
      } else if (this.done) {
        return;
      } else {
        const result = await new Promise<IteratorResult<T>>((resolve) => this.resolvers.push(resolve));
        if (result.done) return;
        yield result.value;
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    queue.push(2);
    queue.close();

    const results: number[] = [];
    for await (const item of queue) {
      results.push(item);
    }
    console.log(results); // [1, 2]
  }
  demo();
}
