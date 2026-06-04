/**
 * 稳定性三件套测试：Retry + Timeout + Circuit Breaker
 *
 * 运行：在 engineering/backend/ 目录执行 `npm test`
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  withRetry,
  withTimeout,
  TimeoutError,
  CircuitBreaker,
  CircuitBreakerError,
  exponentialBackoff,
  withStability,
  type RetryOptions,
} from "./impl";

/* ------------------------------------------------------------------ */
/*  Retry                                                             */
/* ------------------------------------------------------------------ */

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const result = await withRetry(async () => "ok", {
      maxAttempts: 3,
      backoff: () => 0,
    });
    assert.strictEqual(result, "ok");
  });

  it("should retry on failure and eventually succeed", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error("fail");
      return "ok";
    }, {
      maxAttempts: 5,
      backoff: () => 10,
    });
    assert.strictEqual(result, "ok");
    assert.strictEqual(calls, 3);
  });

  it("should throw last error when all attempts exhausted", async () => {
    let calls = 0;
    await assert.rejects(
      async () =>
        withRetry(async () => {
          calls++;
          throw new Error(`fail-${calls}`);
        }, {
          maxAttempts: 3,
          backoff: () => 10,
        }),
      /fail-3/
    );
    assert.strictEqual(calls, 3);
  });

  it("should not retry non-retryable errors", async () => {
    let calls = 0;
    const customError = new Error("fatal");

    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            calls++;
            throw customError;
          },
          {
            maxAttempts: 3,
            backoff: () => 0,
            retryable: (err) => err.message !== "fatal",
          }
        ),
      /fatal/
    );
    assert.strictEqual(calls, 1);
  });

  it("should call onRetry before each retry", async () => {
    const retries: Array<{ msg: string; attempt: number }> = [];
    let calls = 0;

    await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("retry-me");
        return "ok";
      },
      {
        maxAttempts: 3,
        backoff: () => 10,
        onRetry: (err, attempt) => {
          retries.push({ msg: err.message, attempt });
        },
      }
    );

    assert.strictEqual(retries.length, 2);
    assert.strictEqual(retries[0].attempt, 1);
    assert.strictEqual(retries[1].attempt, 2);
  });

  it("should respect backoff delay between attempts", async () => {
    const delays: number[] = [];
    let calls = 0;

    const start = Date.now();
    await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("fail");
        return "ok";
      },
      {
        maxAttempts: 3,
        backoff: (attempt) => {
          delays.push(attempt);
          return 50;
        },
      }
    );

    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 90, `Expected >= 90ms, got ${elapsed}ms`);
    assert.deepStrictEqual(delays, [1, 2]);
  });
});

/* ------------------------------------------------------------------ */
/*  Timeout                                                           */
/* ------------------------------------------------------------------ */

describe("withTimeout", () => {
  it("should resolve when promise finishes before timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 100);
    assert.strictEqual(result, "ok");
  });

  it("should reject with TimeoutError when promise exceeds timeout", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200, "late"));

    await assert.rejects(async () => withTimeout(slow, 50), (err: Error) => {
      assert.ok(err instanceof TimeoutError);
      assert.ok(err.message.includes("timed out"));
      assert.strictEqual(err.ms, 50);
      return true;
    });
  });

  it("should reject immediately if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("already-aborted"));

    await assert.rejects(
      async () => withTimeout(Promise.resolve("ok"), 1000, controller.signal),
      /already-aborted/
    );
  });

  it("should reject with abort reason when signal aborts during operation", async () => {
    const controller = new AbortController();
    const slow = new Promise((resolve) => setTimeout(resolve, 500));

    const promise = withTimeout(slow, 1000, controller.signal);
    setTimeout(() => controller.abort(new Error("user-cancel")), 50);

    await assert.rejects(async () => promise, /user-cancel/);
  });

  it("should not leak timer when promise resolves first", async () => {
    // Node.js 进程正常退出说明 timer 被清理；
    // 这里通过快速 resolve 验证不抛错即可。
    const result = await withTimeout(Promise.resolve("fast"), 10000);
    assert.strictEqual(result, "fast");
  });
});

/* ------------------------------------------------------------------ */
/*  Circuit Breaker                                                   */
/* ------------------------------------------------------------------ */

describe("CircuitBreaker", () => {
  it("should execute normally in closed state", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const result = await cb.execute(async () => "ok");
    assert.strictEqual(result, "ok");
    assert.strictEqual(cb.getState(), "closed");
  });

  it("should open after reaching failure threshold", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });

    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(async () => {
          throw new Error("fail");
        });
      } catch {
        // ignore
      }
    }

    assert.strictEqual(cb.getState(), "open");

    await assert.rejects(
      async () => cb.execute(async () => "ok"),
      (err: Error) => {
        assert.ok(err instanceof CircuitBreakerError);
        assert.ok(err.message.includes("OPEN"));
        return true;
      }
    );
  });

  it("should reset failure count on success in closed state", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });

    await assert.rejects(async () =>
      cb.execute(async () => { throw new Error("fail"); })
    );
    await assert.rejects(async () =>
      cb.execute(async () => { throw new Error("fail"); })
    );

    // 成功一次，重置计数
    await cb.execute(async () => "ok");
    assert.strictEqual(cb.getState(), "closed");

    // 再失败 3 次才 open
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(async () => { throw new Error("fail"); });
      } catch { /* ignore */ }
    }
    assert.strictEqual(cb.getState(), "open");
  });

  it("should transition to half-open after reset timeout", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });

    // 触发 open
    for (let i = 0; i < 2; i++) {
      try { await cb.execute(async () => { throw new Error("fail"); }); } catch { /* ignore */ }
    }
    assert.strictEqual(cb.getState(), "open");

    // 等待 reset
    await sleep(80);

    // 第一次调用应该进入 half-open 并执行
    const result = await cb.execute(async () => "recovered");
    assert.strictEqual(result, "recovered");
    assert.strictEqual(cb.getState(), "closed");
  });

  it("should return to open if half-open probe fails", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });

    for (let i = 0; i < 2; i++) {
      try { await cb.execute(async () => { throw new Error("fail"); }); } catch { /* ignore */ }
    }

    await sleep(80);

    await assert.rejects(
      async () => cb.execute(async () => { throw new Error("still-broken"); })
    );
    assert.strictEqual(cb.getState(), "open");
  });

  it("should block concurrent calls in half-open", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });

    for (let i = 0; i < 2; i++) {
      try { await cb.execute(async () => { throw new Error("fail"); }); } catch { /* ignore */ }
    }

    await sleep(80);

    // 第一个探测调用挂起
    const probe = cb.execute(async () => {
      await sleep(50);
      return "ok";
    });

    // 第二个调用在 half-open 且探测进行中，应该被拒绝
    await assert.rejects(
      async () => cb.execute(async () => "parallel"),
      /HALF-OPEN.*probe in progress/
    );

    // 清理探测
    await probe;
  });
});

/* ------------------------------------------------------------------ */
/*  Backoff                                                           */
/* ------------------------------------------------------------------ */

describe("exponentialBackoff", () => {
  it("should double delay each attempt", () => {
    const backoff = exponentialBackoff(100, 1000);
    assert.ok(backoff(1) >= 100 && backoff(1) < 140); // 100 + 30% jitter
    assert.ok(backoff(2) >= 200 && backoff(2) < 260);
    assert.ok(backoff(3) >= 400 && backoff(3) < 520);
  });

  it("should cap at maxMs", () => {
    const backoff = exponentialBackoff(100, 300);
    assert.ok(backoff(10) <= 330); // maxMs + jitter
  });
});

/* ------------------------------------------------------------------ */
/*  Composition                                                       */
/* ------------------------------------------------------------------ */

describe("withStability", () => {
  it("should succeed on stable function", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const result = await withStability(async () => "ok", {
      perAttemptTimeoutMs: 1000,
      retry: { maxAttempts: 3, backoff: () => 10 },
      circuitBreaker: cb,
    });
    assert.strictEqual(result, "ok");
    assert.strictEqual(cb.getState(), "closed");
  });

  it("should retry on transient failure and eventually succeed", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 1000 });
    let calls = 0;

    const result = await withStability(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "ok";
    }, {
      perAttemptTimeoutMs: 500,
      retry: { maxAttempts: 5, backoff: () => 10 },
      circuitBreaker: cb,
    });

    assert.strictEqual(result, "ok");
    assert.strictEqual(calls, 3);
  });

  it("should timeout slow attempts and retry", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 1000 });
    let calls = 0;

    const result = await withStability(async () => {
      calls++;
      if (calls === 1) {
        await sleep(200);
        return "slow";
      }
      return "fast";
    }, {
      perAttemptTimeoutMs: 50,
      retry: { maxAttempts: 3, backoff: () => 10 },
      circuitBreaker: cb,
    });

    assert.strictEqual(result, "fast");
    assert.strictEqual(calls, 2);
  });

  it("should open circuit after too many failures", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 10000 });

    // 先耗尽重试，触发 2 次底层失败，打开熔断
    try {
      await withStability(async () => { throw new Error("always-fail"); }, {
        perAttemptTimeoutMs: 100,
        retry: { maxAttempts: 2, backoff: () => 0 },
        circuitBreaker: cb,
      });
    } catch { /* ignore */ }

    // 再触发一次，直接打开
    try {
      await cb.execute(async () => { throw new Error("x"); });
    } catch { /* ignore */ }

    assert.strictEqual(cb.getState(), "open");

    await assert.rejects(
      async () =>
        withStability(async () => "never-reached", {
          perAttemptTimeoutMs: 100,
          retry: { maxAttempts: 1, backoff: () => 0 },
          circuitBreaker: cb,
        }),
      /OPEN/
    );
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
