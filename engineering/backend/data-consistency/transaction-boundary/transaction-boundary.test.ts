/**
 * Transaction Boundary + Idempotency Key 测试
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  IdempotencyKeyStore,
  IdempotencyConflictError,
  IdempotencyTimeoutError,
  analyzeTransactionBoundary,
  generateIdempotencyKey,
  type Operation,
} from "./impl";

/* ------------------------------------------------------------------ */
/*  Idempotency Key Store                                             */
/* ------------------------------------------------------------------ */

describe("IdempotencyKeyStore", () => {
  it("should execute and cache result on first call", async () => {
    const store = new IdempotencyKeyStore();
    let calls = 0;

    const result = await store.execute(
      "key-1",
      async () => {
        calls++;
        return { id: 42 };
      },
      { ttlMs: 10000, onConflict: "reject" }
    );

    assert.deepStrictEqual(result, { id: 42 });
    assert.strictEqual(calls, 1);

    const record = store.getRecord("key-1");
    assert.strictEqual(record?.status, "completed");
    assert.deepStrictEqual(record?.response, { id: 42 });
  });

  it("should return cached result on duplicate key without re-executing", async () => {
    const store = new IdempotencyKeyStore();
    let calls = 0;

    const opts = { ttlMs: 10000, onConflict: "reject" };

    const r1 = await store.execute("key-2", async () => { calls++; return "a"; }, opts);
    const r2 = await store.execute("key-2", async () => { calls++; return "b"; }, opts);

    assert.strictEqual(r1, "a");
    assert.strictEqual(r2, "a");
    assert.strictEqual(calls, 1);
  });

  it("should reject when key is already processing", async () => {
    const store = new IdempotencyKeyStore();

    const promise = store.execute(
      "key-3",
      async () => {
        await sleep(100);
        return "done";
      },
      { ttlMs: 10000, onConflict: "reject" }
    );

    // 立即发送重复请求
    await assert.rejects(
      async () =>
        store.execute("key-3", async () => "never", {
          ttlMs: 10000,
          onConflict: "reject",
        }),
      (err: Error) => {
        assert.ok(err instanceof IdempotencyConflictError);
        assert.ok(err.message.includes("already being processed"));
        return true;
      }
    );

    await promise; // 清理
  });

  it("should wait and return result when using wait strategy", async () => {
    const store = new IdempotencyKeyStore();

    const promise1 = store.execute(
      "key-4",
      async () => {
        await sleep(50);
        return "shared-result";
      },
      { ttlMs: 10000, onConflict: "wait", waitTimeoutMs: 500 }
    );

    const promise2 = store.execute(
      "key-4",
      async () => "never-reached",
      { ttlMs: 10000, onConflict: "wait", waitTimeoutMs: 500 }
    );

    const [r1, r2] = await Promise.all([promise1, promise2]);
    assert.strictEqual(r1, "shared-result");
    assert.strictEqual(r2, "shared-result");
  });

  it("should timeout when waiting too long for processing", async () => {
    const store = new IdempotencyKeyStore();

    // 启动一个长时间任务
    store.execute(
      "key-5",
      async () => {
        await sleep(500);
        return "slow";
      },
      { ttlMs: 10000, onConflict: "reject" }
    );

    await assert.rejects(
      async () =>
        store.execute("key-5", async () => "never", {
          ttlMs: 10000,
          onConflict: "wait",
          waitTimeoutMs: 50,
        }),
      (err: Error) => {
        assert.ok(err instanceof IdempotencyTimeoutError);
        return true;
      }
    );
  });

  it("should allow retry after previous failure", async () => {
    const store = new IdempotencyKeyStore();
    let calls = 0;

    await assert.rejects(
      async () =>
        store.execute("key-6", async () => { throw new Error("boom"); }, {
          ttlMs: 10000,
          onConflict: "reject",
        })
    );

    assert.strictEqual(store.getRecord("key-6")?.status, "failed");

    const result = await store.execute(
      "key-6",
      async () => {
        calls++;
        return "recovered";
      },
      { ttlMs: 10000, onConflict: "reject" }
    );

    assert.strictEqual(result, "recovered");
    assert.strictEqual(calls, 1);
    assert.strictEqual(store.getRecord("key-6")?.status, "completed");
  });

  it("should propagate error to waiters when processing fails", async () => {
    const store = new IdempotencyKeyStore();

    const p1 = store.execute(
      "key-7",
      async () => {
        await sleep(30);
        throw new Error("processing-fail");
      },
      { ttlMs: 10000, onConflict: "wait", waitTimeoutMs: 500 }
    );

    const p2 = store.execute(
      "key-7",
      async () => "never",
      { ttlMs: 10000, onConflict: "wait", waitTimeoutMs: 500 }
    );

    await assert.rejects(async () => p1, /processing-fail/);
    await assert.rejects(async () => p2, /processing-fail/);
  });

  it("should clean up expired records", async () => {
    const store = new IdempotencyKeyStore();

    await store.execute("key-8", async () => "a", { ttlMs: 50, onConflict: "reject" });
    assert.strictEqual(store.getRecord("key-8")?.status, "completed");

    await sleep(60);
    const removed = store.cleanup();
    assert.strictEqual(removed, 1);
    assert.strictEqual(store.getRecord("key-8"), undefined);
  });

  it("should not clean up non-expired records", async () => {
    const store = new IdempotencyKeyStore();

    await store.execute("key-9", async () => "a", { ttlMs: 10000, onConflict: "reject" });
    const removed = store.cleanup();
    assert.strictEqual(removed, 0);
    assert.strictEqual(store.getRecord("key-9")?.status, "completed");
  });
});

/* ------------------------------------------------------------------ */
/*  Transaction Boundary                                              */
/* ------------------------------------------------------------------ */

describe("analyzeTransactionBoundary", () => {
  it("should return empty for no operations", () => {
    const result = analyzeTransactionBoundary([]);
    assert.deepStrictEqual(result.transactionBoundary, []);
    assert.deepStrictEqual(result.eventualOperations, []);
    assert.ok(result.reason.includes("No operations"));
  });

  it("should not need transaction for read-only operations", () => {
    const ops: Operation[] = [
      { name: "getUser", entity: "user", type: "read", strongConsistency: true },
      { name: "getOrders", entity: "order", type: "read", strongConsistency: true },
    ];
    const result = analyzeTransactionBoundary(ops);
    assert.deepStrictEqual(result.transactionBoundary, []);
    assert.deepStrictEqual(result.eventualOperations, ["getUser", "getOrders"]);
    assert.ok(result.reason.includes("Read-only"));
  });

  it("should not need transaction for single write", () => {
    const ops: Operation[] = [
      { name: "createUser", entity: "user", type: "write", strongConsistency: true },
      { name: "getUser", entity: "user", type: "read", strongConsistency: false },
    ];
    const result = analyzeTransactionBoundary(ops);
    assert.deepStrictEqual(result.transactionBoundary, []);
    assert.deepStrictEqual(result.eventualOperations, ["createUser", "getUser"]);
    assert.ok(result.reason.includes("Single write"));
  });

  it("should require transaction for multiple strong-consistency writes", () => {
    const ops: Operation[] = [
      { name: "debitAccount", entity: "account", type: "write", strongConsistency: true },
      { name: "creditAccount", entity: "account", type: "write", strongConsistency: true },
      { name: "sendNotification", entity: "notification", type: "write", strongConsistency: false },
    ];
    const result = analyzeTransactionBoundary(ops);
    assert.deepStrictEqual(result.transactionBoundary, ["debitAccount", "creditAccount"]);
    assert.deepStrictEqual(result.eventualOperations, ["sendNotification"]);
    assert.ok(result.reason.includes("Multiple strong-consistency"));
  });

  it("should allow eventual consistency when no strong consistency required", () => {
    const ops: Operation[] = [
      { name: "updateCache", entity: "cache", type: "write", strongConsistency: false },
      { name: "writeLog", entity: "log", type: "write", strongConsistency: false },
    ];
    const result = analyzeTransactionBoundary(ops);
    assert.deepStrictEqual(result.transactionBoundary, []);
    assert.deepStrictEqual(result.eventualOperations, ["updateCache", "writeLog"]);
    assert.ok(result.reason.includes("eventual consistency"));
  });
});

/* ------------------------------------------------------------------ */
/*  Key Generation                                                    */
/* ------------------------------------------------------------------ */

describe("generateIdempotencyKey", () => {
  it("should generate deterministic key for same input", () => {
    const k1 = generateIdempotencyKey("client-a", "transfer", { amount: 100 });
    const k2 = generateIdempotencyKey("client-a", "transfer", { amount: 100 });
    assert.strictEqual(k1, k2);
  });

  it("should generate different keys for different inputs", () => {
    const k1 = generateIdempotencyKey("client-a", "transfer", { amount: 100 });
    const k2 = generateIdempotencyKey("client-a", "transfer", { amount: 200 });
    assert.notStrictEqual(k1, k2);
  });

  it("should be sensitive to clientId", () => {
    const k1 = generateIdempotencyKey("client-a", "transfer", { amount: 100 });
    const k2 = generateIdempotencyKey("client-b", "transfer", { amount: 100 });
    assert.notStrictEqual(k1, k2);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
