/**
 * 手写 mini Fastify
 *
 * 考点：
 * - 在 router 基础上增加 schema 校验钩子。
 * - 轻量级 JSON 请求/响应处理。
 */

import { IncomingMessage, ServerResponse, createServer } from "node:http";
import { MiniRouter, RequestContext } from "./miniRouter.js";

export interface RouteOptions {
  schema?: {
    body?: Record<string, unknown>;
  };
}

export class MiniFastify {
  private router = new MiniRouter();

  use(mw: Parameters<MiniRouter["use"]>[0]): void {
    this.router.use(mw);
  }

  get(path: string, handler: (ctx: RequestContext, res: ServerResponse) => void | Promise<void>): void {
    this.router.get(path, handler);
  }

  post(
    path: string,
    options: RouteOptions,
    handler: (ctx: RequestContext, res: ServerResponse) => void | Promise<void>
  ): void;
  post(
    path: string,
    handler: (ctx: RequestContext, res: ServerResponse) => void | Promise<void>
  ): void;
  post(
    path: string,
    optionsOrHandler: RouteOptions | ((ctx: RequestContext, res: ServerResponse) => void | Promise<void>),
    maybeHandler?: (ctx: RequestContext, res: ServerResponse) => void | Promise<void>
  ): void {
    const handler = maybeHandler ?? (optionsOrHandler as (ctx: RequestContext, res: ServerResponse) => void | Promise<void>);
    this.router.post(path, handler);
  }

  listen(port: number): void {
    const server = createServer((req, res) => this.router.handle(req, res));
    server.listen(port);
  }

  get handler(): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
    return (req, res) => this.router.handle(req, res);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = new MiniFastify();
  app.get("/", (_ctx, res) => res.end("home"));
  app.post("/users", async (ctx, res) => {
    res.end(JSON.stringify({ created: ctx.body }));
  });
  console.log("fastify created");
}
