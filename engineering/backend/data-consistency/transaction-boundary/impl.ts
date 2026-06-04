/**
 * 事务边界 + 幂等键设计。
 *
 * 考点：
 * - 幂等状态机：processing → completed / failed，防重复执行
 * - 冲突处理：reject（409）vs wait（轮询/事件）
 * - TTL 与清理：幂等结果不能无限期缓存
 * - 事务边界判断：哪些操作必须在同一事务，哪些可以最终一致
 */

/* ------------------------------------------------------------------ */
/*  Idempotency Key Store                                             */
/* ------------------------------------------------------------------ */

export type IdempotencyStatus = "processing" | "completed" | "failed";

export interface IdempotencyRecord<T = unknown> {
  key: string;
  status: IdempotencyStatus;
  response?: T;
  error?: string;
  createdAt: number;
  expiresAt: number;
}

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyTimeoutError";
  }
}

export interface IdempotencyOptions {
  /** 幂等记录存活时间（毫秒） */
  ttlMs: number;
  /** processing 冲突时的策略 */
  onConflict: "reject" | "wait";
  /** wait 策略下的最大等待时间 */
  waitTimeoutMs?: number;
}

export class IdempotencyKeyStore {
  private store = new Map<string, IdempotencyRecord<unknown>>();
  private waiters = new Map<string, Array<(err?: Error, result?: unknown) => void>>();

  /**
   * 执行带幂等保护的操作。
   *
   * @param key - 幂等键（通常由 client-id + 请求特征哈希生成）
   * @param fn - 实际业务操作
   * @param options - 配置
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    options: IdempotencyOptions
  ): Promise<T> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing) {
      if (existing.status === "completed") {
        return existing.response as T;
      }

      if (existing.status === "processing") {
        if (options.onConflict === "reject") {
          throw new IdempotencyConflictError(
            `Request with key "${key}" is already being processed`
          );
        }
        return this.waitForResult<T>(
          key,
          options.waitTimeoutMs ?? 10000
        );
      }

      if (existing.status === "failed") {
        // 允许重试：删除旧记录，重新执行
        this.store.delete(key);
      }
    }

    // 创建 processing 记录
    this.store.set(key, {
      key,
      status: "processing",
      createdAt: now,
      expiresAt: now + options.ttlMs,
    });

    try {
      const result = await fn();
      this.store.set(key, {
        key,
        status: "completed",
        response: result,
        createdAt: now,
        expiresAt: now + options.ttlMs,
      });
      this.notifyWaiters(key, undefined, result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.store.set(key, {
        key,
        status: "failed",
        error: errorMsg,
        createdAt: now,
        expiresAt: now + options.ttlMs,
      });
      this.notifyWaiters(key, err instanceof Error ? err : new Error(errorMsg));
      throw err;
    }
  }

  /**
   * 清理过期记录，返回清理数量。
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, record] of this.store.entries()) {
      if (record.expiresAt < now) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * 获取当前记录（用于测试和观测）。
   */
  getRecord<T = unknown>(key: string): IdempotencyRecord<T> | undefined {
    return this.store.get(key) as IdempotencyRecord<T> | undefined;
  }

  private waitForResult<T>(key: string, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeWaiter(key, handler);
        reject(
          new IdempotencyTimeoutError(
            `Timeout waiting for idempotency key "${key}"`
          )
        );
      }, timeoutMs);

      const handler = (err?: Error, result?: unknown) => {
        clearTimeout(timer);
        if (err) {
          reject(err);
        } else {
          resolve(result as T);
        }
      };

      const list = this.waiters.get(key) ?? [];
      list.push(handler);
      this.waiters.set(key, list);
    });
  }

  private notifyWaiters(key: string, err?: Error, result?: unknown): void {
    const list = this.waiters.get(key);
    if (!list) return;
    this.waiters.delete(key);
    for (const cb of list) {
      cb(err, result);
    }
  }

  private removeWaiter(
    key: string,
    handler: (err?: Error, result?: unknown) => void
  ): void {
    const list = this.waiters.get(key);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx >= 0) {
      list.splice(idx, 1);
      if (list.length === 0) {
        this.waiters.delete(key);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Transaction Boundary Analyzer                                     */
/* ------------------------------------------------------------------ */

export interface Operation {
  name: string;
  entity: string;
  type: "read" | "write";
  /** 是否要求强一致（必须在同一事务内） */
  strongConsistency: boolean;
}

export interface TransactionBoundaryResult {
  /** 必须在同一事务内的操作名列表 */
  transactionBoundary: string[];
  /** 可以最终一致或异步执行的操作名列表 */
  eventualOperations: string[];
  /** 判断理由 */
  reason: string;
}

/**
 * 分析一组操作的事务边界。
 *
 * 核心规则：
 * 1. 只读操作不需要事务边界（除非需要防止幻读，教学实现中简化）。
 * 2. 单个写操作天然原子，不需要跨实体事务。
 * 3. 多个写操作如果涉及强一致要求，必须在同一事务。
 * 4. 强一致读可以放在事务内，也可以独立（视隔离级别）。
 */
export function analyzeTransactionBoundary(
  operations: Operation[]
): TransactionBoundaryResult {
  if (operations.length === 0) {
    return {
      transactionBoundary: [],
      eventualOperations: [],
      reason: "No operations",
    };
  }

  const writes = operations.filter((op) => op.type === "write");
  const strongOps = operations.filter((op) => op.strongConsistency);

  // 没有写操作：纯读场景，无事务边界
  if (writes.length === 0) {
    return {
      transactionBoundary: [],
      eventualOperations: operations.map((op) => op.name),
      reason: "Read-only: no transaction boundary needed",
    };
  }

  // 单个写操作：天然原子，不需要显式事务边界（除非跨库）
  if (writes.length === 1) {
    return {
      transactionBoundary: [],
      eventualOperations: operations.map((op) => op.name),
      reason: "Single write: atomic by default",
    };
  }

  // 多个写操作：检查是否有强一致要求
  const strongWrites = writes.filter((op) => op.strongConsistency);

  if (strongWrites.length >= 2) {
    return {
      transactionBoundary: strongOps.map((op) => op.name),
      eventualOperations: operations
        .filter((op) => !op.strongConsistency)
        .map((op) => op.name),
      reason: `Multiple strong-consistency writes (${strongWrites.length}) require atomic transaction`,
    };
  }

  // 多个写但无强一致要求：可 Saga / 最终一致
  return {
    transactionBoundary: [],
    eventualOperations: operations.map((op) => op.name),
    reason: "Multiple writes but no strong consistency: eventual consistency acceptable",
  };
}

/**
 * 生成幂等键的推荐方式。
 *
 * 生产环境通常：sha256(clientId + resource + params + nonce)
 * 教学实现简化拼接。
 */
export function generateIdempotencyKey(
  clientId: string,
  operation: string,
  params: Record<string, unknown>
): string {
  const payload = JSON.stringify({ clientId, operation, params });
  // 简化：生产环境应使用 crypto.createHash('sha256').update(payload).digest('hex')
  return `${clientId}:${operation}:${hashCode(payload)}`;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
