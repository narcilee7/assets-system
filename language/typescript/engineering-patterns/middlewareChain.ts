/**
 * 手写 middleware chain
 *
 * 考点：
 * - 洋葱模型。
 * - Koa 风格：context 在 middleware 间传递。
 */

export type Next = () => Promise<unknown> | unknown;
export type Middleware<T> = (ctx: T, next: Next) => Promise<unknown> | unknown;

export function compose<T>(middlewares: Middleware<T>[]): (ctx: T) => Promise<void> {
  return async (ctx: T) => {
    let index = -1;
    async function dispatch(i: number): Promise<unknown> {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      const fn = middlewares[i];
      if (!fn) return;
      return await fn(ctx, () => dispatch(i + 1));
    }
    await dispatch(0);
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  interface Ctx {
    logs: string[];
  }
  const app = compose<Ctx>([
    async (ctx, next) => {
      ctx.logs.push("1 start");
      await next();
      ctx.logs.push("1 end");
    },
    async (ctx, next) => {
      ctx.logs.push("2 start");
      await next();
      ctx.logs.push("2 end");
    },
  ]);
  const ctx: Ctx = { logs: [] };
  app(ctx).then(() => console.log(ctx.logs));
}
