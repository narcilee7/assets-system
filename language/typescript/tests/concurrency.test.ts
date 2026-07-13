import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AsyncQueue,
  boundedGather,
  SafeCounter,
  TokenBucket,
} from "../concurrency/index.js";

describe("concurrency", () => {
  it("SafeCounter increments atomically", async () => {
    const counter = new SafeCounter();
    await Promise.all(Array.from({ length: 100 }, () => counter.increment()));
    assert.equal(counter.get(), 100);
  });

  it("AsyncQueue supports async iteration", async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    queue.push(2);
    queue.close();
    const results: number[] = [];
    for await (const item of queue) {
      results.push(item);
    }
    assert.deepEqual(results, [1, 2]);
  });

  it("boundedGather limits concurrency", async () => {
    let running = 0;
    let maxRunning = 0;
    const results = await boundedGather(
      [1, 2, 3, 4, 5],
      async (n) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 10));
        running--;
        return n * 2;
      },
      { limit: 2 }
    );
    assert.deepEqual(results, [2, 4, 6, 8, 10]);
    assert.ok(maxRunning <= 2);
  });

  it("TokenBucket allows burst then throttles", () => {
    const bucket = new TokenBucket(10, 2);
    assert.equal(bucket.allow(), true);
    assert.equal(bucket.allow(), true);
    assert.equal(bucket.allow(), false);
  });
});
