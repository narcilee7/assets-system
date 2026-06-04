/**
 * 手写 Middleware Pipeline（Koa 风格洋葱模型）。
 *
 * 考点：
 * - 洋葱模型的执行顺序：before -> next -> after
 * - 错误传播：下游抛错，上游 await next() 会 reject
 * - 边界：空数组、重复 next()、不调用 next()
 * - 异步支持：Promise.resolve 统一 sync / async
 */

export type Next = () => Promise<void>;

export type Middleware<C = Record<string, unknown>> = (
  ctx: C,
  next: Next
) => Promise<void> | void;

export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineError";
  }
}

/**
 * Compose middleware into a single function.
 *
 * @param middlewares - Array of middleware functions
 * @returns Composed middleware function
 */
export function compose<C = Record<string, unknown>>(
  middlewares: Middleware<C>[]
): Middleware<C> {
  if (!Array.isArray(middlewares)) {
    throw new TypeError("Middleware stack must be an array");
  }
  for (const fn of middlewares) {
    if (typeof fn !== "function") {
      throw new TypeError("Middleware must be composed of functions");
    }
  }

  return function composed(ctx: C, next?: Next): Promise<void> {
    let index = -1;

    function dispatch(i: number): Promise<void> {
      if (i <= index) {
        return Promise.reject(
          new PipelineError("next() called multiple times")
        );
      }
      index = i;

      let fn: Middleware<C> | undefined = middlewares[i];
      if (i === middlewares.length) {
        fn = next as Middleware<C> | undefined;
      }
      if (!fn) {
        return Promise.resolve();
      }

      try {
        return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  } as Middleware<C>;
}

/**
 * 创建带有日志和计时横切关注点的 pipeline。
 * 用于面试中展示"中间件是横切逻辑的载体"。
 */
export function createTimedPipeline<C extends Record<string, unknown> = Record<string, unknown>>(
  middlewares: Middleware<C>[]
): Middleware<C> {
  const pipeline = compose(middlewares);

  return async (ctx: C, next?: Next) => {
    const start = performance.now();
    console.log(`[pipeline] start ${JSON.stringify(ctx)}`);

    try {
      await pipeline(ctx, next);
    } finally {
      const duration = (performance.now() - start).toFixed(2);
      console.log(`[pipeline] end ${duration}ms`);
    }
  };
}
