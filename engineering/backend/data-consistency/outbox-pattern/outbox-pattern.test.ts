/**
 * Outbox Pattern 测试。
 *
 * 运行：在 engineering/backend/ 目录执行 `npm test`
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  OutboxEventBus,
  OutboxWorker,
  InMemoryOutboxStore,
  InMemoryMessageQueue,
  EventConsumer,
  type EventEnvelope,
  type OutboxRecord,
} from "./impl.js";

/* ------------------------------------------------------------------ */
/*  辅助函数                                                           */
/* ------------------------------------------------------------------ */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createUserCreatedEvent(userId: string, name: string): OutboxRecord {
  return {
    id: `event-${Math.random().toString(36).slice(2)}`,
    aggregateType: "User",
    aggregateId: userId,
    eventType: "UserCreated",
    payload: { userId, name, timestamp: Date.now() },
    createdAt: Date.now(),
    publishedAt: null,
    retryCount: 0,
  };
}

/* ------------------------------------------------------------------ */
/*  OutboxEventBus 测试                                               */
/* ------------------------------------------------------------------ */

describe("OutboxEventBus", () => {
  let store: InMemoryOutboxStore;
  let bus: OutboxEventBus;

  beforeEach(() => {
    store = new InMemoryOutboxStore();
    bus = new OutboxEventBus(store);
  });

  it("writeInTransaction 写入业务数据和 Outbox 记录", async () => {
    const businessFn = async () => ({ userId: "u1", name: "Alice" });

    const result = await bus.writeInTransaction(
      businessFn,
      "User",
      "u1",
      "UserCreated",
      { userId: "u1", name: "Alice" }
    );

    assert.deepStrictEqual(result, { userId: "u1", name: "Alice" });

    const records = store.getRecords();
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].aggregateType, "User");
    assert.strictEqual(records[0].aggregateId, "u1");
    assert.strictEqual(records[0].eventType, "UserCreated");
  });

  it("writeManyInTransaction 写入多个事件", async () => {
    const businessFn = async () => ({ orderId: "o1" });

    const result = await bus.writeManyInTransaction(businessFn, [
      {
        aggregateType: "Order",
        aggregateId: "o1",
        eventType: "OrderCreated",
        payload: { orderId: "o1" },
      },
      {
        aggregateType: "Order",
        aggregateId: "o1",
        eventType: "OrderValidated",
        payload: { orderId: "o1" },
      },
    ]);

    assert.deepStrictEqual(result, { orderId: "o1" });

    const records = store.getRecords();
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].eventType, "OrderCreated");
    assert.strictEqual(records[1].eventType, "OrderValidated");
  });

  it("每个事件有唯一 ID", async () => {
    const businessFn = async () => ({});

    await bus.writeInTransaction(businessFn, "User", "u1", "EventA", {});
    await bus.writeInTransaction(businessFn, "User", "u2", "EventB", {});

    const records = store.getRecords();
    assert.notStrictEqual(records[0].id, records[1].id);
  });
});

/* ------------------------------------------------------------------ */
/*  OutboxWorker 测试                                                 */
/* ------------------------------------------------------------------ */

describe("OutboxWorker", () => {
  let store: InMemoryOutboxStore;
  let queue: InMemoryMessageQueue;
  let worker: OutboxWorker;

  beforeEach(() => {
    store = new InMemoryOutboxStore();
    queue = new InMemoryMessageQueue();
    worker = new OutboxWorker(store, queue, "events", {
      batchSize: 10,
      pollIntervalMs: 100,
      maxRetries: 3,
      retentionMs: 60000,
    });
  });

  afterEach(async () => {
    await worker.stop();
  });

  it("poll 发布未发布的事件", async () => {
    await store.insert(createUserCreatedEvent("u1", "Alice"));
    await store.insert(createUserCreatedEvent("u2", "Bob"));

    const result = await worker.poll();

    assert.strictEqual(result.published, 2);
    assert.strictEqual(result.failed, 0);

    const published = queue.getPublished();
    assert.strictEqual(published.length, 2);
    assert.strictEqual(published[0].aggregateType, "User");
    assert.strictEqual(published[0].eventType, "UserCreated");
  });

  it("poll 标记已发布的事件", async () => {
    await store.insert(createUserCreatedEvent("u1", "Alice"));

    await worker.poll();

    const records = store.getRecords();
    assert.notStrictEqual(records[0].publishedAt, null);
  });

  it("poll 跳过已发布的事件", async () => {
    await store.insert({
      ...createUserCreatedEvent("u1", "Alice"),
      publishedAt: Date.now(),
    });

    const result = await worker.poll();

    assert.strictEqual(result.published, 0);
    assert.strictEqual(queue.getPublished().length, 0);
  });

  it("poll 失败时增加重试计数", async () => {
    const failingQueue = new (class implements InMemoryMessageQueue {
      async publish(): Promise<void> {
        throw new Error("Network error");
      }
    })();

    const failingWorker = new OutboxWorker(store, failingQueue, "events", {
      batchSize: 10,
      pollIntervalMs: 100,
      maxRetries: 3,
    });

    await store.insert(createUserCreatedEvent("u1", "Alice"));

    const result = await failingWorker.poll();

    assert.strictEqual(result.published, 0);
    assert.strictEqual(result.failed, 1);

    const records = store.getRecords();
    assert.strictEqual(records[0].retryCount, 1);
  });

  it("超过最大重试次数后不再发布", async () => {
    await store.insert({
      ...createUserCreatedEvent("u1", "Alice"),
      retryCount: 3,
    });

    const result = await worker.poll();

    assert.strictEqual(result.published, 0);
    assert.strictEqual(queue.getPublished().length, 0);
  });

  it("cleanup 删除过期已发布事件", async () => {
    const now = Date.now();

    await store.insert({
      ...createUserCreatedEvent("u1", "Alice"),
      publishedAt: now - 120000,
    });

    await store.insert({
      ...createUserCreatedEvent("u2", "Bob"),
      publishedAt: now - 30000,
    });

    await store.insert(createUserCreatedEvent("u3", "Charlie"));

    const deleted = await worker.cleanup();

    assert.strictEqual(deleted, 1);

    const records = store.getRecords();
    assert.strictEqual(records.length, 2);
  });
});

/* ------------------------------------------------------------------ */
/*  EventConsumer 测试                                                */
/* ------------------------------------------------------------------ */

describe("EventConsumer", () => {
  let consumer: EventConsumer;

  beforeEach(() => {
    consumer = new EventConsumer();
  });

  it("首次消费返回 true", async () => {
    const event: EventEnvelope = {
      id: "e1",
      aggregateType: "User",
      aggregateId: "u1",
      eventType: "UserCreated",
      payload: {},
      createdAt: Date.now(),
      publishedAt: Date.now(),
    };

    const result = await consumer.consume(event);

    assert.strictEqual(result, true);
    assert.strictEqual(consumer.getProcessedCount(), 1);
  });

  it("重复消费返回 false", async () => {
    const event: EventEnvelope = {
      id: "e1",
      aggregateType: "User",
      aggregateId: "u1",
      eventType: "UserCreated",
      payload: {},
      createdAt: Date.now(),
      publishedAt: Date.now(),
    };

    await consumer.consume(event);
    const result = await consumer.consume(event);

    assert.strictEqual(result, false);
    assert.strictEqual(consumer.getProcessedCount(), 1);
  });

  it("不同事件 ID 分别处理", async () => {
    const event1: EventEnvelope = {
      id: "e1",
      aggregateType: "User",
      aggregateId: "u1",
      eventType: "UserCreated",
      payload: {},
      createdAt: Date.now(),
      publishedAt: Date.now(),
    };

    const event2: EventEnvelope = {
      id: "e2",
      aggregateType: "User",
      aggregateId: "u2",
      eventType: "UserCreated",
      payload: {},
      createdAt: Date.now(),
      publishedAt: Date.now(),
    };

    await consumer.consume(event1);
    const result2 = await consumer.consume(event2);

    assert.strictEqual(result2, true);
    assert.strictEqual(consumer.getProcessedCount(), 2);
  });
});

/* ------------------------------------------------------------------ */
/*  集成测试：完整流程                                                 */
/* ------------------------------------------------------------------ */

describe("集成：完整 Outbox 流程", () => {
  it("业务操作 + Outbox 写入 + Worker 发布 + 消费者消费", async () => {
    const store = new InMemoryOutboxStore();
    const queue = new InMemoryMessageQueue();
    const bus = new OutboxEventBus(store);
    const worker = new OutboxWorker(store, queue, "events", {
      batchSize: 10,
      pollIntervalMs: 100,
    });
    const consumer = new EventConsumer();

    const result = await bus.writeInTransaction(
      async () => ({ userId: "u1", name: "Alice" }),
      "User",
      "u1",
      "UserCreated",
      { userId: "u1", name: "Alice" }
    );

    assert.deepStrictEqual(result, { userId: "u1", name: "Alice" });

    const pollResult = await worker.poll();
    assert.strictEqual(pollResult.published, 1);

    const published = queue.getPublished();
    assert.strictEqual(published.length, 1);

    const consumed = await consumer.consume(published[0]);
    assert.strictEqual(consumed, true);

    const consumedAgain = await consumer.consume(published[0]);
    assert.strictEqual(consumedAgain, false);

    await worker.stop();
  });

  it("多个事件按创建顺序发布", async () => {
    const store = new InMemoryOutboxStore();
    const queue = new InMemoryMessageQueue();
    const bus = new OutboxEventBus(store);
    const worker = new OutboxWorker(store, queue, "events", {
      batchSize: 10,
      pollIntervalMs: 100,
    });

    await bus.writeInTransaction(
      async () => {},
      "Order",
      "o1",
      "OrderCreated",
      { orderId: "o1" }
    );

    await delay(10);

    await bus.writeInTransaction(
      async () => {},
      "Order",
      "o1",
      "OrderValidated",
      { orderId: "o1" }
    );

    await worker.poll();

    const published = queue.getPublished();
    assert.strictEqual(published.length, 2);
    assert.strictEqual(published[0].eventType, "OrderCreated");
    assert.strictEqual(published[1].eventType, "OrderValidated");

    await worker.stop();
  });
});