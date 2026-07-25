import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compose,
  DIContainer,
  EventBus,
  InMemoryRepository,
  ObjectSource,
  RetryPolicy,
  UnitOfWork,
  loadConfig,
} from "../engineering-patterns/index.js";

describe("engineering-patterns", () => {
  it("middleware chain composes in onion order", async () => {
    const logs: string[] = [];
    const app = compose([
      async (_ctx, next) => {
        logs.push("1 start");
        await next();
        logs.push("1 end");
      },
      async (_ctx, next) => {
        logs.push("2 start");
        await next();
        logs.push("2 end");
      },
    ]);
    await app({});
    assert.deepEqual(logs, ["1 start", "2 start", "2 end", "1 end"]);
  });

  it("RetryPolicy retries then succeeds", async () => {
    let attempts = 0;
    const policy = new RetryPolicy({ maxAttempts: 3, delay: 0 });
    const result = await policy.run(() => {
      attempts++;
      if (attempts < 3) throw new Error("fail");
      return "ok";
    });
    assert.equal(result, "ok");
  });

  it("EventBus emits to subscribers", async () => {
    const bus = new EventBus();
    const received: unknown[] = [];
    bus.on("test", (x) => received.push(x));
    await bus.emit("test", 42);
    assert.deepEqual(received, [42]);
  });

  it("loadConfig parses env", () => {
    const schema = {
      port: { parser: Number, default: 3000 },
      debug: { parser: (v: string) => v === "true", default: false },
    };
    const source = new ObjectSource({ PORT: "8080", DEBUG: "true" });
    const config = loadConfig(schema, source);
    assert.deepEqual(config, { port: 8080, debug: true });
  });

  it("InMemoryRepository CRUD", async () => {
    interface User {
      id: number;
      name: string;
    }
    const repo = new InMemoryRepository<User, number>();
    await repo.save({ id: 1, name: "Ada" });
    assert.equal((await repo.findById(1))?.name, "Ada");
    await repo.delete(1);
    assert.equal(await repo.findById(1), null);
  });

  it("UnitOfWork rolls back on failure", async () => {
    const uow = new UnitOfWork();
    const state: string[] = [];
    uow.register(
      () => state.push("a"),
      () => state.pop()
    );
    uow.register(
      () => {
        throw new Error("fail");
      },
      () => state.pop()
    );
    try {
      await uow.commit();
      assert.fail("should throw");
    } catch {
      assert.deepEqual(state, []);
    }
  });

  it("DIContainer resolves singleton", () => {
    const container = new DIContainer();
    container.register("counter", () => ({ value: 0 }), { singleton: true });
    const a = container.resolve<{ value: number }>("counter");
    const b = container.resolve<{ value: number }>("counter");
    assert.equal(a, b);
  });
});
