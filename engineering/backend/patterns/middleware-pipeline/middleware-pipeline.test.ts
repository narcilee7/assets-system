/**
 * Middleware Pipeline 测试
 *
 * 运行：在 engineering/backend/ 目录执行 `npm test`
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { compose, createTimedPipeline, PipelineError, type Middleware } from "./impl";

describe("compose", () => {
  it("should execute middlewares in onion order", async () => {
    const order: string[] = [];

    const m1: Middleware = async (_ctx, next) => {
      order.push("m1-before");
      await next();
      order.push("m1-after");
    };

    const m2: Middleware = async (_ctx, next) => {
      order.push("m2-before");
      await next();
      order.push("m2-after");
    };

    const m3: Middleware = async (_ctx, next) => {
      order.push("m3-before");
      await next();
      order.push("m3-after");
    };

    const pipeline = compose([m1, m2, m3]);
    await pipeline({});

    assert.deepStrictEqual(order, [
      "m1-before",
      "m2-before",
      "m3-before",
      "m3-after",
      "m2-after",
      "m1-after",
    ]);
  });

  it("should pass context through all middlewares", async () => {
    const m1: Middleware<{ count: number }> = async (ctx, next) => {
      ctx.count += 1;
      await next();
      ctx.count += 10;
    };

    const m2: Middleware<{ count: number }> = async (ctx, next) => {
      ctx.count += 1;
      await next();
      ctx.count += 10;
    };

    const pipeline = compose([m1, m2]);
    const ctx = { count: 0 };
    await pipeline(ctx);

    // m1+1 -> m2+1 -> m2+10 -> m1+10 = 22
    assert.strictEqual(ctx.count, 22);
  });

  it("should resolve immediately with empty middleware array", async () => {
    const pipeline = compose([]);
    await pipeline({});
    // 不抛错即为通过
    assert.ok(true);
  });

  it("should propagate error from downstream and stop subsequent middlewares", async () => {
    const order: string[] = [];

    const m1: Middleware = async (_ctx, next) => {
      order.push("m1-before");
      await next();
      order.push("m1-after");
    };

    const m2: Middleware = async (_ctx, next) => {
      order.push("m2-before");
      throw new Error("m2-error");
    };

    const m3: Middleware = async (_ctx, next) => {
      order.push("m3-before");
      await next();
      order.push("m3-after");
    };

    const pipeline = compose([m1, m2, m3]);

    await assert.rejects(async () => pipeline({}), /m2-error/);
    assert.deepStrictEqual(order, ["m1-before", "m2-before"]);
  });

  it("should allow upstream to catch downstream error", async () => {
    const order: string[] = [];

    const m1: Middleware = async (_ctx, next) => {
      order.push("m1-before");
      try {
        await next();
      } catch (err) {
        order.push("m1-catch");
      }
      order.push("m1-after");
    };

    const m2: Middleware = async (_ctx, next) => {
      throw new Error("m2-error");
    };

    const pipeline = compose([m1, m2]);
    await pipeline({});

    assert.deepStrictEqual(order, ["m1-before", "m1-catch", "m1-after"]);
  });

  it("should reject when next() is called multiple times", async () => {
    const badMiddleware: Middleware = async (_ctx, next) => {
      await next();
      await next(); // 重复调用
    };

    const pipeline = compose([badMiddleware]);

    await assert.rejects(async () => pipeline({}), (err: Error) => {
      assert.ok(err instanceof PipelineError);
      assert.ok(err.message.includes("next() called multiple times"));
      return true;
    });
  });

  it("should stop chain when middleware does not call next()", async () => {
    const order: string[] = [];

    const m1: Middleware = async (_ctx, next) => {
      order.push("m1-before");
      await next();
      order.push("m1-after");
    };

    const m2: Middleware = async (_ctx, _next) => {
      order.push("m2-before");
      // 不调用 next
    };

    const m3: Middleware = async (_ctx, next) => {
      order.push("m3-before");
      await next();
      order.push("m3-after");
    };

    const pipeline = compose([m1, m2, m3]);
    await pipeline({});

    assert.deepStrictEqual(order, ["m1-before", "m2-before", "m1-after"]);
  });

  it("should support final next (root handler)", async () => {
    const order: string[] = [];

    const m1: Middleware = async (_ctx, next) => {
      order.push("m1-before");
      await next();
      order.push("m1-after");
    };

    const rootHandler = async () => {
      order.push("root");
    };

    const pipeline = compose([m1]);
    await pipeline({}, rootHandler);

    assert.deepStrictEqual(order, ["m1-before", "root", "m1-after"]);
  });

  it("should reject non-array input", () => {
    assert.throws(() => compose(null as any), /must be an array/);
    assert.throws(() => compose(undefined as any), /must be an array/);
    assert.throws(() => compose("string" as any), /must be an array/);
  });

  it("should reject non-function middleware", () => {
    assert.throws(() => compose([() => {}, null as any]), /must be composed of functions/);
  });

  it("should support sync middleware", async () => {
    const order: string[] = [];

    const syncMiddleware: Middleware = (_ctx, next) => {
      order.push("sync-before");
      next(); // 不 await，但 compose 内部用 Promise.resolve 包装
    };

    const asyncMiddleware: Middleware = async (_ctx, next) => {
      order.push("async-before");
      await next();
      order.push("async-after");
    };

    const pipeline = compose([syncMiddleware, asyncMiddleware]);
    await pipeline({});

    assert.deepStrictEqual(order, ["sync-before", "async-before", "async-after"]);
  });
});

describe("createTimedPipeline", () => {
  it("should wrap pipeline with timing log", async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    try {
      const m1: Middleware = async (_ctx, next) => {
        await next();
      };

      const timed = createTimedPipeline([m1]);
      await timed({ id: 42 });

      assert.ok(logs.some((l) => l.includes("start")));
      assert.ok(logs.some((l) => l.includes("end")));
      assert.ok(logs.some((l) => l.includes("ms")));
    } finally {
      console.log = originalLog;
    }
  });
});
