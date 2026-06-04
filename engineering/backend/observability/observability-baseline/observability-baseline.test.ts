/**
 * Observability Baseline 测试
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  StructuredLogger,
  MetricsCollector,
  createTraceContext,
  getCurrentTraceContext,
  withTrace,
  HealthChecker,
  ObservableService,
  type LogEntry,
  type HealthStatus,
} from "./impl";

/* ------------------------------------------------------------------ */
/*  Logger                                                            */
/* ------------------------------------------------------------------ */

describe("StructuredLogger", () => {
  it("should log at configured level and above", () => {
    const entries: LogEntry[] = [];
    const logger = new StructuredLogger({
      minLevel: "warn",
      sink: (e) => entries.push(e),
    });

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].level, "warn");
    assert.strictEqual(entries[1].level, "error");
  });

  it("should include default fields in every log", () => {
    const entries: LogEntry[] = [];
    const logger = new StructuredLogger({
      defaultFields: { service: "test", env: "dev" },
      sink: (e) => entries.push(e),
    });

    logger.info("hello");

    assert.strictEqual(entries[0].service, "test");
    assert.strictEqual(entries[0].env, "dev");
    assert.strictEqual(entries[0].message, "hello");
  });

  it("should merge child fields with parent fields", () => {
    const entries: LogEntry[] = [];
    const parent = new StructuredLogger({
      defaultFields: { service: "test" },
      sink: (e) => entries.push(e),
    });
    const child = parent.child({ requestId: "req-1" });

    child.info("child log");

    assert.strictEqual(entries[0].service, "test");
    assert.strictEqual(entries[0].requestId, "req-1");
  });

  it("should include meta fields in log entry", () => {
    const entries: LogEntry[] = [];
    const logger = new StructuredLogger({ sink: (e) => entries.push(e) });

    logger.info("msg", { userId: 42, action: "login" });

    assert.strictEqual(entries[0].userId, 42);
    assert.strictEqual(entries[0].action, "login");
  });

  it("should include trace context when inside withTrace", async () => {
    const entries: LogEntry[] = [];
    const logger = new StructuredLogger({ sink: (e) => entries.push(e) });
    const ctx = createTraceContext();

    await withTrace(ctx, async () => {
      logger.info("in trace");
    });

    assert.strictEqual(entries[0].traceId, ctx.traceId);
    assert.strictEqual(entries[0].spanId, ctx.spanId);
  });
});

/* ------------------------------------------------------------------ */
/*  Metrics                                                           */
/* ------------------------------------------------------------------ */

describe("MetricsCollector", () => {
  it("should increment counter", () => {
    const m = new MetricsCollector();
    m.increment("requests");
    m.increment("requests", 2);
    assert.strictEqual(m.getCounter("requests"), 3);
  });

  it("should return 0 for unknown counter", () => {
    const m = new MetricsCollector();
    assert.strictEqual(m.getCounter("unknown"), 0);
  });

  it("should record histogram values", () => {
    const m = new MetricsCollector();
    m.recordHistogram("latency", 10);
    m.recordHistogram("latency", 20);
    m.recordHistogram("latency", 30);

    const values = m.getHistogram("latency");
    assert.deepStrictEqual(values, [10, 20, 30]);
  });

  it("should compute summary statistics", () => {
    const m = new MetricsCollector();
    for (let i = 1; i <= 100; i++) {
      m.recordHistogram("latency", i);
    }

    const s = m.summary("latency")!;
    assert.strictEqual(s.count, 100);
    assert.strictEqual(s.min, 1);
    assert.strictEqual(s.max, 100);
    assert.strictEqual(s.avg, 50.5);
    assert.strictEqual(s.p95, 95);
    assert.strictEqual(s.p99, 99);
  });

  it("should return null for empty histogram", () => {
    const m = new MetricsCollector();
    assert.strictEqual(m.summary("empty"), null);
  });

  it("should reset all metrics", () => {
    const m = new MetricsCollector();
    m.increment("c");
    m.recordHistogram("h", 1);
    m.reset();
    assert.strictEqual(m.getCounter("c"), 0);
    assert.deepStrictEqual(m.getHistogram("h"), []);
  });
});

/* ------------------------------------------------------------------ */
/*  Trace                                                             */
/* ------------------------------------------------------------------ */

describe("TraceContext", () => {
  it("should create trace context with unique ids", () => {
    const ctx1 = createTraceContext();
    const ctx2 = createTraceContext();

    assert.ok(ctx1.traceId);
    assert.ok(ctx1.spanId);
    assert.notStrictEqual(ctx1.traceId, ctx2.traceId);
    assert.notStrictEqual(ctx1.spanId, ctx2.spanId);
  });

  it("should create child context with same traceId", () => {
    const parent = createTraceContext();
    const child = createTraceContext(parent);

    assert.strictEqual(child.traceId, parent.traceId);
    assert.strictEqual(child.parentSpanId, parent.spanId);
    assert.notStrictEqual(child.spanId, parent.spanId);
  });

  it("should propagate context through withTrace", async () => {
    const ctx = createTraceContext();

    await withTrace(ctx, async () => {
      const current = getCurrentTraceContext();
      assert.strictEqual(current?.traceId, ctx.traceId);
      assert.strictEqual(current?.spanId, ctx.spanId);
    });
  });

  it("should not leak context outside withTrace", async () => {
    const ctx = createTraceContext();

    assert.strictEqual(getCurrentTraceContext(), undefined);

    await withTrace(ctx, async () => {
      assert.ok(getCurrentTraceContext());
    });

    assert.strictEqual(getCurrentTraceContext(), undefined);
  });

  it("should support nested traces", async () => {
    const outer = createTraceContext();

    await withTrace(outer, async () => {
      const inner = createTraceContext(getCurrentTraceContext()!);

      await withTrace(inner, async () => {
        const current = getCurrentTraceContext()!;
        assert.strictEqual(current.traceId, outer.traceId);
        assert.strictEqual(current.parentSpanId, outer.spanId);
        assert.strictEqual(current.spanId, inner.spanId);
      });
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Health Check                                                      */
/* ------------------------------------------------------------------ */

describe("HealthChecker", () => {
  it("should report healthy when all checks pass", async () => {
    const checker = new HealthChecker();
    checker.register({
      name: "db",
      check: async () => "healthy",
    });

    const report = await checker.checkAll();
    assert.strictEqual(report.status, "healthy");
    assert.strictEqual(report.checks.db, "healthy");
  });

  it("should report unhealthy when any check fails", async () => {
    const checker = new HealthChecker();
    checker.register({ name: "db", check: async () => "healthy" });
    checker.register({ name: "cache", check: async () => "unhealthy" });

    const report = await checker.checkAll();
    assert.strictEqual(report.status, "unhealthy");
    assert.strictEqual(report.checks.cache, "unhealthy");
  });

  it("should report degraded when no unhealthy but some degraded", async () => {
    const checker = new HealthChecker();
    checker.register({ name: "db", check: async () => "healthy" });
    checker.register({ name: "cache", check: async () => "degraded" });

    const report = await checker.checkAll();
    assert.strictEqual(report.status, "degraded");
  });

  it("should mark check unhealthy on exception", async () => {
    const checker = new HealthChecker();
    checker.register({
      name: "api",
      check: async () => {
        throw new Error("down");
      },
    });

    const report = await checker.checkAll();
    assert.strictEqual(report.status, "unhealthy");
    assert.strictEqual(report.checks.api, "unhealthy");
  });

  it("should filter readiness checks", async () => {
    const checker = new HealthChecker();
    checker.register({ name: "db", check: async () => "healthy" });
    checker.register({
      name: "liveness-only",
      affectsReadiness: false,
      check: async () => "unhealthy",
    });

    const all = await checker.checkAll();
    assert.strictEqual(all.status, "unhealthy");

    const ready = await checker.checkReadiness();
    assert.strictEqual(ready.status, "healthy");
    assert.strictEqual(ready.checks["liveness-only"], undefined);
  });
});

/* ------------------------------------------------------------------ */
/*  Observable Service                                                */
/* ------------------------------------------------------------------ */

describe("ObservableService", () => {
  it("should record success metrics and logs", async () => {
    const metrics = new MetricsCollector();
    const logs: LogEntry[] = [];
    const logger = new StructuredLogger({ sink: (e) => logs.push(e) });
    const svc = new ObservableService({ name: "test-svc", logger, metrics });

    const result = await svc.run("getUser", async () => ({ id: 1 }));

    assert.deepStrictEqual(result, { id: 1 });
    assert.strictEqual(metrics.getCounter("getUser_success"), 1);
    assert.strictEqual(metrics.getCounter("getUser_failure"), 0);
    assert.ok(metrics.summary("getUser_duration_ms")!.count >= 1);
    assert.ok(logs.some((l) => l.message.includes("getUser started")));
    assert.ok(logs.some((l) => l.message.includes("getUser completed")));
  });

  it("should record failure metrics and logs", async () => {
    const metrics = new MetricsCollector();
    const logs: LogEntry[] = [];
    const logger = new StructuredLogger({ sink: (e) => logs.push(e) });
    const svc = new ObservableService({ name: "test-svc", logger, metrics });

    await assert.rejects(
      async () =>
        svc.run("saveUser", async () => {
          throw new Error("db-error");
        }),
      /db-error/
    );

    assert.strictEqual(metrics.getCounter("saveUser_failure"), 1);
    assert.strictEqual(metrics.getCounter("saveUser_success"), 0);
    assert.ok(logs.some((l) => l.level === "error"));
  });

  it("should include trace context in operation logs", async () => {
    const logs: LogEntry[] = [];
    const logger = new StructuredLogger({ sink: (e) => logs.push(e) });
    const svc = new ObservableService({ name: "test-svc", logger });
    const ctx = createTraceContext();

    await withTrace(ctx, async () => {
      await svc.run("op", async () => "ok");
    });

    const startLog = logs.find((l) => l.message.includes("op started"));
    assert.ok(startLog);
    assert.strictEqual(startLog.traceId, ctx.traceId);
  });
});
