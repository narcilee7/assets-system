/**
 * 可观测性基线：Structured Logger + Metrics + Trace Context + Health Check。
 *
 * 考点：
 * - 日志必须结构化（JSON），不要只打字符串
 * - Metrics 要可聚合：counter + histogram，不是原始日志
 * - Trace 要跨函数传播：AsyncLocalStorage 是 Node.js 的标准方案
 * - Health Check 要区分 liveness（进程存活）和 readiness（可接受流量）
 */

import { AsyncLocalStorage } from "node:async_hooks";

/* ------------------------------------------------------------------ */
/*  Structured Logger                                                 */
/* ------------------------------------------------------------------ */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  spanId?: string;
  traceId?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  /** 最小输出级别 */
  minLevel?: LogLevel;
  /** 全局默认字段 */
  defaultFields?: Record<string, unknown>;
  /** 自定义输出目标，默认 console.log */
  sink?: (entry: LogEntry) => void;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class StructuredLogger {
  private minLevel: LogLevel;
  private fields: Record<string, unknown>;
  private sink: (entry: LogEntry) => void;

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? "info";
    this.fields = { ...(options.defaultFields ?? {}) };
    this.sink = options.sink ?? ((entry) => console.log(JSON.stringify(entry)));
  }

  child(extraFields: Record<string, unknown>): StructuredLogger {
    return new StructuredLogger({
      minLevel: this.minLevel,
      defaultFields: { ...this.fields, ...extraFields },
      sink: this.sink,
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const trace = getCurrentTraceContext();

    this.sink({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.fields,
      ...meta,
      ...(trace ?? {}),
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Metrics                                                           */
/* ------------------------------------------------------------------ */

export interface MetricSummary {
  count: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
}

export class MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  increment(name: string, value = 1): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  recordHistogram(name: string, value: number): void {
    const list = this.histograms.get(name) ?? [];
    list.push(value);
    this.histograms.set(name, list);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  getHistogram(name: string): number[] {
    return [...(this.histograms.get(name) ?? [])];
  }

  summary(name: string): MetricSummary | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const min = sorted[0];
    const max = sorted[count - 1];
    const avg = sum / count;
    const p95 = sorted[Math.floor((count - 1) * 0.95)] ?? max;
    const p99 = sorted[Math.floor((count - 1) * 0.99)] ?? max;

    return { count, min, max, avg, p95, p99 };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

/* ------------------------------------------------------------------ */
/*  Trace Context                                                     */
/* ------------------------------------------------------------------ */

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

const traceStorage = new AsyncLocalStorage<TraceContext>();

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTraceContext(parent?: TraceContext): TraceContext {
  return {
    traceId: parent?.traceId ?? generateId(),
    spanId: generateId(),
    parentSpanId: parent?.spanId,
  };
}

export function getCurrentTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

export async function withTrace<T>(
  ctx: TraceContext,
  fn: () => Promise<T>
): Promise<T> {
  return traceStorage.run(ctx, fn);
}

/* ------------------------------------------------------------------ */
/*  Health Check                                                      */
/* ------------------------------------------------------------------ */

export type HealthStatus = "healthy" | "unhealthy" | "degraded";

export interface HealthCheckDefinition {
  name: string;
  /** 是否影响 readiness（默认 true） */
  affectsReadiness?: boolean;
  check: () => Promise<HealthStatus> | HealthStatus;
}

export interface HealthReport {
  status: HealthStatus;
  checks: Record<string, HealthStatus>;
}

export class HealthChecker {
  private checks: HealthCheckDefinition[] = [];

  register(check: HealthCheckDefinition): void {
    this.checks.push(check);
  }

  async checkAll(): Promise<HealthReport> {
    const results: Record<string, HealthStatus> = {};
    let overall: HealthStatus = "healthy";

    for (const def of this.checks) {
      try {
        const status = await def.check();
        results[def.name] = status;
        if (status === "unhealthy") {
          overall = "unhealthy";
        } else if (status === "degraded" && overall !== "unhealthy") {
          overall = "degraded";
        }
      } catch (err) {
        results[def.name] = "unhealthy";
        overall = "unhealthy";
      }
    }

    return { status: overall, checks: results };
  }

  /**
   * 只返回 readiness 相关的检查（用于 K8s readinessProbe）。
   */
  async checkReadiness(): Promise<HealthReport> {
    const readinessChecks = this.checks.filter(
      (c) => c.affectsReadiness !== false
    );
    const results: Record<string, HealthStatus> = {};
    let overall: HealthStatus = "healthy";

    for (const def of readinessChecks) {
      try {
        const status = await def.check();
        results[def.name] = status;
        if (status === "unhealthy") {
          overall = "unhealthy";
        } else if (status === "degraded" && overall !== "unhealthy") {
          overall = "degraded";
        }
      } catch (err) {
        results[def.name] = "unhealthy";
        overall = "unhealthy";
      }
    }

    return { status: overall, checks: results };
  }
}

/* ------------------------------------------------------------------ */
/*  Integration: Observable Service                                   */
/* ------------------------------------------------------------------ */

/**
 * 演示如何把 logger / metrics / trace / health 组合成一个可观测服务基类。
 */
export interface ObservableServiceOptions {
  name: string;
  logger?: StructuredLogger;
  metrics?: MetricsCollector;
}

export class ObservableService {
  readonly name: string;
  readonly logger: StructuredLogger;
  readonly metrics: MetricsCollector;
  readonly health: HealthChecker;

  constructor(options: ObservableServiceOptions) {
    this.name = options.name;
    this.logger =
      options.logger ??
      new StructuredLogger({ defaultFields: { service: options.name } });
    this.metrics = options.metrics ?? new MetricsCollector();
    this.health = new HealthChecker();
  }

  async run<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const trace = getCurrentTraceContext();
    const childLogger = trace
      ? this.logger.child({ operation: operationName, ...trace })
      : this.logger.child({ operation: operationName });

    childLogger.info(`${operationName} started`);

    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.metrics.recordHistogram(`${operationName}_duration_ms`, duration);
      this.metrics.increment(`${operationName}_success`);
      childLogger.info(`${operationName} completed`, { duration_ms: duration });
      return result;
    } catch (err) {
      const duration = performance.now() - start;
      this.metrics.recordHistogram(`${operationName}_duration_ms`, duration);
      this.metrics.increment(`${operationName}_failure`);
      childLogger.error(`${operationName} failed`, {
        duration_ms: duration,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
