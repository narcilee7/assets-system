/**
 * 手写 mini router
 *
 * 考点：
 * - 路由注册、dispatch、路径参数。
 * - 中间件洋葱模型。
 */

import { IncomingMessage, ServerResponse } from "node:http";

export type Handler = (req: RequestContext, res: ServerResponse) => void | Promise<void>;
export type Middleware = (req: RequestContext, res: ServerResponse, next: () => Promise<void>) => void | Promise<void>;

export interface RequestContext {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: IncomingMessage["headers"];
  body?: unknown;
}

export class MiniRouter {
  private routes: Array<{
    method: string;
    pattern: string;
    paramNames: string[];
    handler: Handler;
  }> = [];
  private middlewares: Middleware[] = [];

  use(mw: Middleware): void {
    this.middlewares.push(mw);
  }

  get(path: string, handler: Handler): void {
    this.add("GET", path, handler);
  }

  post(path: string, handler: Handler): void {
    this.add("POST", path, handler);
  }

  private add(method: string, path: string, handler: Handler): void {
    const paramNames: string[] = [];
    const pattern = path
      .split("/")
      .map((seg) => {
        if (seg.startsWith(":")) {
          paramNames.push(seg.slice(1));
          return "([^/]+)";
        }
        return seg;
      })
      .join("/");
    this.routes.push({ method, pattern, paramNames, handler });
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const ctx = this.buildContext(req);
    const route = this.match(ctx.method, ctx.path);

    if (!route) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    ctx.params = route.params;
    const stack = [...this.middlewares, route.handler];
    let index = -1;

    async function next(): Promise<void> {
      index++;
      const fn = stack[index];
      if (!fn) return;
      if (index === stack.length - 1) {
        await (fn as Handler)(ctx, res);
      } else {
        await (fn as Middleware)(ctx, res, next);
      }
    }

    await next();
  }

  private buildContext(req: IncomingMessage): RequestContext {
    const url = new URL(req.url ?? "/", "http://localhost");
    const query: Record<string, string> = {};
    for (const [key, value] of url.searchParams) {
      query[key] = value;
    }
    return {
      method: req.method ?? "GET",
      path: url.pathname,
      params: {},
      query,
      headers: req.headers,
    };
  }

  private match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const regex = new RegExp(`^${route.pattern}$`);
      const match = path.match(regex);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const router = new MiniRouter();
  router.get("/", (_ctx, res) => {
    res.end("home");
  });
  router.get("/users/:id", (ctx, res) => {
    res.end(`user ${ctx.params.id}`);
  });

  // Demo with mock request/response omitted for brevity
  console.log("router created");
}
