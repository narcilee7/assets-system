import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, get } from "node:http";
import {
  MiniAgentRuntime,
  MiniCacheTTL,
  MiniFastify,
  MiniPubSub,
  MiniRouter,
  MiniScheduler,
  MiniSSE,
  MiniTaskQueue,
  MiniTestRunner,
  Model,
  assertEqual,
} from "../mini-runtime/index.js";

describe("mini-runtime", () => {
  it("MiniRouter matches routes and params", async () => {
    const router = new MiniRouter();
    let captured: Record<string, string> = {};
    router.get("/users/:id", (ctx, res) => {
      captured = ctx.params;
      res.end(`user ${ctx.params.id}`);
    });

    const { req, res } = createMockReqRes("GET", "/users/42");
    await router.handle(req, res as unknown as import("node:http").ServerResponse);
    assert.deepEqual(captured, { id: "42" });
    assert.equal((res as MockResponse).body, "user 42");
  });

  it("MiniRouter returns 404 for unknown route", async () => {
    const router = new MiniRouter();
    const { req, res } = createMockReqRes("GET", "/missing");
    await router.handle(req, res as unknown as import("node:http").ServerResponse);
    assert.equal((res as MockResponse).statusCode, 404);
  });

  it("MiniFastify starts and handles requests", async () => {
    const app = new MiniFastify();
    app.get("/health", (_ctx, res) => res.end("ok"));

    const server = createServerFromHandler(app.handler);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const body = await httpGet(`http://127.0.0.1:${port}/health`);
    assert.equal(body, "ok");
    server.close();
  });

  it("Model and Query support CRUD", () => {
    interface User {
      id: number;
      name: string;
      age: number;
    }
    const users = new Model<User>("users");
    users.insert({ id: 1, name: "Ada", age: 30 });
    users.insert({ id: 2, name: "Bob", age: 25 });
    users.insert({ id: 3, name: "Cid", age: 35 });

    const result = users
      .query()
      .where((u) => u.age >= 30)
      .orderBy("age")
      .limit(2)
      .execute();

    assert.deepEqual(result.map((u) => u.name), ["Ada", "Cid"]);
  });

  it("MiniTestRunner reports pass and fail", async () => {
    const runner = new MiniTestRunner();
    runner.test("pass", () => assertEqual(1 + 1, 2));
    runner.test("fail", () => assertEqual(1 + 1, 3));

    let exitCode: number | undefined;
    const originalExit = process.exit;
    (process as { exit: (code?: number) => never }).exit = ((code?: number) => {
      exitCode = code;
    }) as (code?: number) => never;

    await runner.run();
    (process as { exit: (code?: number) => never }).exit = originalExit;
    assert.equal(exitCode, 1);
  });

  it("MiniTaskQueue respects concurrency and retries", async () => {
    const q = new MiniTaskQueue(1);
    let running = 0;
    let maxRunning = 0;

    const results = await Promise.all([
      q.add(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await sleep(10);
        running--;
        return "a";
      }),
      q.add(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await sleep(10);
        running--;
        return "b";
      }),
    ]);

    assert.equal(maxRunning, 1);
    assert.deepEqual(
      results.map((r) => r.value),
      ["a", "b"]
    );
  });

  it("MiniTaskQueue retries then fails", async () => {
    const q = new MiniTaskQueue(1);
    let attempts = 0;
    const result = await q.add(
      () => {
        attempts++;
        throw new Error("fail");
      },
      { retries: 2, backoff: 0 }
    );
    assert.equal(attempts, 3);
    assert.equal(result.status, "error");
  });

  it("MiniAgentRuntime runs tool chain", async () => {
    const agent = new MiniAgentRuntime({ maxSteps: 5 });
    agent.registerTool<string, string>({
      name: "echo",
      execute: (params) => `echo:${params}`,
    });

    const result = await agent.run("call tool:echo hello");
    assert.equal(result, "echo:hello");
    assert.equal(agent.getState(), "done");
    assert.ok(agent.getTrace().some((s) => s.role === "tool"));
  });

  it("MiniCacheTTL evicts LRU and expires", async () => {
    const events: string[] = [];
    const cache = new MiniCacheTTL<string, number>({ maxSize: 2, defaultTTL: 30 });
    cache.on("evict", (k) => events.push(`evict:${k}`));
    cache.on("expire", (k) => events.push(`expire:${k}`));

    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);

    assert.deepEqual(events, ["evict:b"]);
    assert.equal(cache.get("a"), 1);
    assert.equal(cache.get("c"), 3);

    await sleep(50);
    assert.equal(cache.get("a"), undefined);
    assert.ok(events.includes("expire:a"));
  });

  it("MiniScheduler schedules and cancels", async () => {
    const scheduler = new MiniScheduler();
    let count = 0;
    const id = scheduler.schedule(() => count++, 5);

    await sleep(30);
    assert.ok(count >= 1);
    scheduler.cancel(id);
    scheduler.stop();
  });

  it("MiniScheduler supports interval", async () => {
    const scheduler = new MiniScheduler();
    let count = 0;
    const id = scheduler.schedule(() => count++, 5, 20);

    await sleep(60);
    scheduler.cancel(id);
    assert.ok(count >= 2);
  });

  it("MiniPubSub supports wildcards", async () => {
    const bus = new MiniPubSub();
    const received: string[] = [];

    bus.subscribe("user.*.created", (_data, topic) => received.push(topic));
    bus.subscribe("order.#", (_data, topic) => received.push(topic));

    await bus.publish("user.123.created", {});
    await bus.publish("order.a.b.c", {});
    await bus.publish("user.456.updated", {});

    assert.deepEqual(received, ["user.123.created", "order.a.b.c"]);
  });

  it("MiniSSE broadcasts messages", async () => {
    const sse = new MiniSSE();
    const { res, chunks } = createMockResponse();
    const cleanup = sse.connect({} as import("node:http").IncomingMessage, res as unknown as import("node:http").ServerResponse);

    sse.broadcast("update", { count: 1 });
    sse.broadcast("update", { count: 2 });

    const body = chunks.join("");
    assert.ok(body.includes("event: update"));
    assert.ok(body.includes('data: {"count":1}'));
    assert.ok(body.includes('data: {"count":2}'));

    cleanup();
    sse.close();
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MockResponse {
  statusCode: number;
  body: string;
  headers: Record<string, number | string | string[]>;
}

function createMockReqRes(method: string, url: string) {
  const req = {
    method,
    url,
    headers: {},
  } as unknown as import("node:http").IncomingMessage;

  const wrapped: MockResponse & { writeHead: (code: number, headers?: Record<string, number | string | string[]>) => void; setHeader: (name: string, value: number | string | string[]) => void; write: (chunk: string) => boolean; end: (chunk?: string) => void; on: () => void } = {
    statusCode: 200,
    body: "",
    headers: {},
    setHeader(_name: string, _value: number | string | string[]) {},
    writeHead(code: number, headers?: Record<string, number | string | string[]>) {
      wrapped.statusCode = code;
      if (headers) wrapped.headers = { ...wrapped.headers, ...headers };
    },
    write(chunk: string) {
      wrapped.body += chunk;
      return true;
    },
    end(chunk?: string) {
      if (chunk) wrapped.body += chunk;
    },
    on() {},
  };

  return { req, res: wrapped };
}

function createMockResponse() {
  const chunks: string[] = [];
  const res = {
    writeHead() {},
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end(chunk?: string) {
      if (chunk) chunks.push(chunk);
    },
    on() {},
  };
  return { res, chunks };
}

function createServerFromHandler(handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => Promise<void>) {
  return createServer((req, res) => handler(req, res));
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });
}
