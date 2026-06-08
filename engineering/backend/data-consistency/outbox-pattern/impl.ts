/**
 * Outbox Pattern 实现：事务内双写 + 后台轮询发布。
 *
 * 核心概念：
 * - 业务表 + outbox 表在同一事务写入
 * - 后台 Worker 轮询 outbox，发布到消息队列
 * - 消费者根据事件 ID 去重，实现幂等
 */

import { randomUUID } from "crypto";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OutboxRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: number;
  publishedAt: number | null;
  retryCount: number;
}

export interface EventEnvelope {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: number;
  publishedAt: number;
}

/** 消息队列接口（抽象） */
export interface MessageQueue {
  publish(topic: string, message: EventEnvelope): Promise<void>;
}

/** 存储接口（抽象） */
export interface OutboxStore {
  insert(record: OutboxRecord): Promise<void>;
  findUnpublished(limit: number): Promise<OutboxRecord[]>;
  markPublished(ids: string[], publishedAt: number): Promise<void>;
  markFailed(id: string, retryCount: number): Promise<void>;
  deletePublishedBefore(beforeTimestamp: number): Promise<number>;
}

/* ------------------------------------------------------------------ */
/*  OutboxEventBus：事务内双写入口                                     */
/* ------------------------------------------------------------------ */

export class OutboxEventBus {
  constructor(private store: OutboxStore) {}

  /**
   * 在事务内写入业务数据和 Outbox 记录。
   * 实际使用时需要在调用方的事务内调用此方法。
   *
   * @param businessFn - 执行业务操作（插入用户等）
   * @param aggregateType - 聚合类型
   * @param aggregateId - 聚合 ID
   * @param eventType - 事件类型
   * @param payload - 事件负载
   */
  async writeInTransaction<T>(
    businessFn: () => Promise<T>,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<T> {
    // 生成事件 ID（用于幂等）
    const eventId = randomUUID();
    const now = Date.now();

    // 构建 Outbox 记录
    const record: OutboxRecord = {
      id: eventId,
      aggregateType,
      aggregateId,
      eventType,
      payload,
      createdAt: now,
      publishedAt: null,
      retryCount: 0,
    };

    // 业务操作和 Outbox 写入必须在同一事务
    // 这里简化处理，实际使用时由调用方控制事务边界
    const result = await businessFn();

    // 写入 Outbox（同一事务）
    await this.store.insert(record);

    return result;
  }

  /**
   * 批量写入多个事件（同一事务）。
   */
  async writeManyInTransaction<T>(
    businessFn: () => Promise<T>,
    events: Array<{
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      payload: Record<string, unknown>;
    }>
  ): Promise<T> {
    const now = Date.now();

    const records: OutboxRecord[] = events.map((e) => ({
      id: randomUUID(),
      aggregateType: e.aggregateType,
      aggregateId: e.aggregateId,
      eventType: e.eventType,
      payload: e.payload,
      createdAt: now,
      publishedAt: null,
      retryCount: 0,
    }));

    const result = await businessFn();

    // 同一事务写入所有 Outbox 记录
    for (const record of records) {
      await this.store.insert(record);
    }

    return result;
  }
}

/* ------------------------------------------------------------------ */
/*  OutboxWorker：后台轮询发布                                         */
/* ------------------------------------------------------------------ */

export interface OutboxWorkerOptions {
  /** 批量大小 */
  batchSize: number;
  /** 轮询间隔（毫秒） */
  pollIntervalMs: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 清理已发布事件的保留时间（毫秒） */
  retentionMs: number;
}

const DEFAULT_OPTIONS: OutboxWorkerOptions = {
  batchSize: 100,
  pollIntervalMs: 1000,
  maxRetries: 5,
  retentionMs: 7 * 24 * 60 * 60 * 1000, // 7 天
};

export class OutboxWorker {
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private store: OutboxStore,
    private queue: MessageQueue,
    private topic: string,
    private options: Partial<OutboxWorkerOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 启动 Worker，开始轮询发布。
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // 主轮询循环
    this.intervalId = setInterval(async () => {
      if (!this.running) return;
      await this.poll();
    }, this.options.pollIntervalMs!);

    // 定期清理已发布事件
    this.cleanupIntervalId = setInterval(async () => {
      if (!this.running) return;
      await this.cleanup();
    }, 60 * 60 * 1000); // 每小时清理一次
  }

  /**
   * 停止 Worker。
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * 执行一次轮询 + 发布。
   * 公开方法，用于手动触发或测试。
   */
  async poll(): Promise<{ published: number; failed: number }> {
    const unpublished = await this.store.findUnpublished(this.options.batchSize!);

    if (unpublished.length === 0) {
      return { published: 0, failed: 0 };
    }

    let published = 0;
    let failed = 0;

    // 按 aggregateType + aggregateId 分组，保留最新事件（如果需要折叠）
    // 这里简化处理，每个事件独立发布

    const successfulIds: string[] = [];

    for (const record of unpublished) {
      // 跳过超过最大重试次数的事件（死信）
      if (record.retryCount >= this.options.maxRetries!) {
        await this.store.markFailed(record.id, record.retryCount);
        failed++;
        continue;
      }

      const envelope: EventEnvelope = {
        id: record.id,
        aggregateType: record.aggregateType,
        aggregateId: record.aggregateId,
        eventType: record.eventType,
        payload: record.payload,
        createdAt: record.createdAt,
        publishedAt: Date.now(),
      };

      try {
        await this.queue.publish(this.topic, envelope);
        successfulIds.push(record.id);
        published++;
      } catch (err) {
        // 发布失败，增加重试计数
        const newRetryCount = record.retryCount + 1;
        await this.store.markFailed(record.id, newRetryCount);
        failed++;

        // 如果超过最大重试次数，记录但不阻塞其他事件
        if (newRetryCount >= this.options.maxRetries!) {
          console.error(
            `Outbox event ${record.id} exceeded max retries, marking as dead letter`
          );
        }
      }
    }

    // 批量标记已发布
    if (successfulIds.length > 0) {
      await this.store.markPublished(successfulIds, Date.now());
    }

    return { published, failed };
  }

  /**
   * 清理已发布的过期事件。
   */
  async cleanup(): Promise<number> {
    const cutoff = Date.now() - this.options.retentionMs!;
    return this.store.deletePublishedBefore(cutoff);
  }

  /**
   * 获取 Worker 状态（用于观测）。
   */
  isRunning(): boolean {
    return this.running;
  }
}

/* ------------------------------------------------------------------ */
/*  In-Memory 实现（用于测试）                                         */
/* ------------------------------------------------------------------ */

export class InMemoryOutboxStore implements OutboxStore {
  private records: OutboxRecord[] = [];

  async insert(record: OutboxRecord): Promise<void> {
    this.records.push({ ...record });
  }

  async findUnpublished(limit: number): Promise<OutboxRecord[]> {
    return this.records
      .filter((r) => r.publishedAt === null && r.retryCount < 5)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit);
  }

  async markPublished(ids: string[], publishedAt: number): Promise<void> {
    for (const id of ids) {
      const record = this.records.find((r) => r.id === id);
      if (record) {
        record.publishedAt = publishedAt;
      }
    }
  }

  async markFailed(id: string, retryCount: number): Promise<void> {
    const record = this.records.find((r) => r.id === id);
    if (record) {
      record.retryCount = retryCount;
    }
  }

  async deletePublishedBefore(beforeTimestamp: number): Promise<number> {
    const before = this.records.length;
    this.records = this.records.filter(
      (r) => r.publishedAt === null || r.publishedAt >= beforeTimestamp
    );
    return before - this.records.length;
  }

  getRecords(): OutboxRecord[] {
    return this.records;
  }

  clear(): void {
    this.records = [];
  }
}

export class InMemoryMessageQueue implements MessageQueue {
  private published: EventEnvelope[] = [];

  async publish(_topic: string, message: EventEnvelope): Promise<void> {
    this.published.push({ ...message });
  }

  getPublished(): EventEnvelope[] {
    return this.published;
  }

  clear(): void {
    this.published = [];
  }
}

/* ------------------------------------------------------------------ */
/*  消费者去重（基于事件 ID）                                          */
/* ------------------------------------------------------------------ */

export class EventConsumer {
  private processedIds = new Set<string>();

  /**
   * 消费事件，自动去重。
   * @returns true 表示处理了，false 表示重复（已跳过）
   */
  async consume(event: EventEnvelope): Promise<boolean> {
    if (this.processedIds.has(event.id)) {
      return false; // 重复，跳过
    }

    // 处理业务逻辑（子类实现或传入 handler）
    this.processedIds.add(event.id);
    return true;
  }

  /**
   * 获取已处理的事件 ID 数量（用于观测）。
   */
  getProcessedCount(): number {
    return this.processedIds.size;
  }

  /**
   * 清理过期的去重记录，防止内存膨胀。
   * @param maxAgeMs 超过此时间的事件 ID 将被清理
   */
  cleanup(maxAgeMs: number): number {
    // 注意：这里简化处理，实际需要记录每个事件的时间戳
    // 清理时按时间排序删除最旧的
    // 暂时返回 0，实际实现需要额外的数据结构
    return 0;
  }
}