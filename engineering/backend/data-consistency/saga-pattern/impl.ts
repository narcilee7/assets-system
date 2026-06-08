/**
 * Saga Pattern 实现：长事务补偿模式。
 *
 * 核心概念：
 * - SagaStep: 单个步骤，包含 execute 和 compensate
 * - SagaOrchestrator: 编排器，管理步骤执行和补偿
 * - 状态机: running → completed / compensating / failed
 */

import { randomUUID } from "crypto";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SagaStatus = "running" | "completed" | "compensating" | "failed";

export interface SagaStepResult {
  stepName: string;
  success: boolean;
  error?: Error;
}

export interface SagaResult {
  sagaId: string;
  status: SagaStatus;
  steps: SagaStepResult[];
  completedSteps: string[];
  compensatedSteps: string[];
  finalError?: Error;
}

export interface SagaOptions {
  /** 补偿最大重试次数 */
  maxRetries?: number;
  /** 补偿重试间隔（毫秒） */
  retryDelayMs?: number;
  /** 步骤执行超时（毫秒） */
  timeoutMs?: number;
  /** 步骤失败回调 */
  onStepFailed?: (stepName: string, error: Error, ctx: unknown) => void;
  /** Saga 完成回调 */
  onSagaCompleted?: (ctx: unknown) => void;
  /** Saga 失败回调 */
  onSagaFailed?: (error: Error, ctx: unknown, compensated: boolean) => void;
}

const DEFAULT_OPTIONS: Required<SagaOptions> = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  onStepFailed: () => {},
  onSagaCompleted: () => {},
  onSagaFailed: () => {},
};

/* ------------------------------------------------------------------ */
/*  Saga Step Interface                                                */
/* ------------------------------------------------------------------ */

export interface SagaStep<TContext = unknown> {
  /** 步骤名称 */
  name: string;
  /** 执行正向操作 */
  execute(ctx: TContext): Promise<void>;
  /** 执行补偿操作（必须幂等） */
  compensate(ctx: TContext): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Saga Orchestrator                                                  */
/* ------------------------------------------------------------------ */

export class SagaOrchestrator<TContext = unknown> {
  private sagaId: string;
  private status: SagaStatus = "running";
  private completedStepNames: string[] = [];
  private stepResults: SagaStepResult[] = [];
  private options: Required<SagaOptions>;

  constructor(
    private steps: SagaStep<TContext>[],
    options: Partial<SagaOptions> = {}
  ) {
    this.sagaId = randomUUID().slice(0, 8);
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 执行 Saga。
   */
  async execute(ctx: TContext): Promise<SagaResult> {
    // 按顺序执行所有步骤
    for (const step of this.steps) {
      if (this.status === "failed") break;

      try {
        await this.executeStep(step, ctx);
        this.completedStepNames.push(step.name);
        this.stepResults.push({ stepName: step.name, success: true });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.stepResults.push({ stepName: step.name, success: false, error: err });
        this.options.onStepFailed(step.name, err, ctx);

        // 开始补偿流程
        await this.compensate(ctx);

        return this.buildResult(err);
      }
    }

    if (this.status === "running") {
      this.status = "completed";
      this.options.onSagaCompleted(ctx);
    }

    return this.buildResult();
  }

  /**
   * 执行单个步骤（带超时控制）。
   */
  private async executeStep(step: SagaStep<TContext>, ctx: TContext): Promise<void> {
    if (this.options.timeoutMs > 0) {
      await this.withTimeout(step.execute(ctx), this.options.timeoutMs, step.name);
    } else {
      await step.execute(ctx);
    }
  }

  /**
   * 带超时的 Promise。
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number, stepName: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Step "${stepName}" timed out after ${ms}ms`));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  /**
   * 执行补偿（按相反顺序）。
   */
  private async compensate(ctx: TContext): Promise<void> {
    this.status = "compensating";

    // 按相反顺序补偿已完成的步骤
    const stepsToCompensate = this.completedStepNames.slice().reverse();

    for (const stepName of stepsToCompensate) {
      const step = this.steps.find((s) => s.name === stepName);
      if (!step) continue;

      let retries = 0;
      while (retries <= this.options.maxRetries) {
        try {
          await step.compensate(ctx);
          break; // 补偿成功，继续下一步
        } catch (error) {
          retries++;
          if (retries > this.options.maxRetries) {
            console.error(
              `Compensation for step "${stepName}" failed after ${this.options.maxRetries} retries`,
              error
            );
            // 继续尝试其他补偿，不要在这里停止
          } else {
            await this.delay(this.options.retryDelayMs);
          }
        }
      }
    }

    // 补偿完成后，状态设为 failed（因为原始步骤失败了）
    this.status = "failed";
    this.options.onSagaFailed(
      this.stepResults.find((r) => !r.success)?.error ?? new Error("Saga failed"),
      ctx,
      stepsToCompensate.length > 0
    );
  }

  /**
   * 延迟工具。
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 构建最终结果。
   */
  private buildResult(finalError?: Error): SagaResult {
    return {
      sagaId: this.sagaId,
      status: this.status,
      steps: this.stepResults,
      completedSteps: this.completedStepNames,
      compensatedSteps:
        this.status === "compensating" ? this.completedStepNames.slice().reverse() : [],
      finalError,
    };
  }

  /**
   * 获取当前状态。
   */
  getStatus(): SagaStatus {
    return this.status;
  }

  /**
   * 获取 Saga ID。
   */
  getSagaId(): string {
    return this.sagaId;
  }
}

/* ------------------------------------------------------------------ */
/*  Saga Builder（流式构建）                                          */
/* ------------------------------------------------------------------ */

export class SagaBuilder<TContext = unknown> {
  private steps: SagaStep<TContext>[] = [];
  private options: Partial<SagaOptions> = {};

  addStep(step: SagaStep<TContext>): this {
    this.steps.push(step);
    return this;
  }

  withOptions(options: Partial<SagaOptions>): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  build(): SagaOrchestrator<TContext> {
    return new SagaOrchestrator(this.steps, this.options);
  }
}

/* ------------------------------------------------------------------ */
/*  补偿失败死信处理                                                   */
/* ------------------------------------------------------------------ */

export interface DeadLetterRecord {
  sagaId: string;
  stepName: string;
  error: string;
  context: unknown;
  failedAt: number;
  retryCount: number;
}

export class SagaDeadLetterQueue {
  private queue: DeadLetterRecord[] = [];

  add(record: Omit<DeadLetterRecord, "failedAt" | "retryCount">): void {
    this.queue.push({
      ...record,
      failedAt: Date.now(),
      retryCount: 0,
    });
  }

  getAll(): DeadLetterRecord[] {
    return this.queue;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

/* ------------------------------------------------------------------ */
/*  订单流程 Saga 示例                                                */
/* ------------------------------------------------------------------ */

export interface OrderSagaContext {
  orderId?: string;
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentInfo?: { method: string; amount: number };
  shippingInfo?: { address: string };
  inventoryReserved?: boolean;
  paymentProcessed?: boolean;
  orderCreated?: boolean;
  shipped?: boolean;
}

/**
 * 创建订单 Saga 步骤工厂。
 */
export function createOrderSagaSteps(
  services: {
    createOrder: (ctx: OrderSagaContext) => Promise<void>;
    reserveInventory: (ctx: OrderSagaContext) => Promise<void>;
    processPayment: (ctx: OrderSagaContext) => Promise<void>;
    scheduleShipping: (ctx: OrderSagaContext) => Promise<void>;
    cancelOrder: (ctx: OrderSagaContext) => Promise<void>;
    releaseInventory: (ctx: OrderSagaContext) => Promise<void>;
    refundPayment: (ctx: OrderSagaContext) => Promise<void>;
  }
): SagaStep<OrderSagaContext>[] {
  return [
    {
      name: "createOrder",
      execute: async (ctx) => {
        await services.createOrder(ctx);
        ctx.orderCreated = true;
      },
      compensate: async (ctx) => {
        if (ctx.orderId) {
          await services.cancelOrder(ctx);
        }
      },
    },
    {
      name: "reserveInventory",
      execute: async (ctx) => {
        await services.reserveInventory(ctx);
        ctx.inventoryReserved = true;
      },
      compensate: async (ctx) => {
        await services.releaseInventory(ctx);
      },
    },
    {
      name: "processPayment",
      execute: async (ctx) => {
        await services.processPayment(ctx);
        ctx.paymentProcessed = true;
      },
      compensate: async (ctx) => {
        await services.refundPayment(ctx);
      },
    },
    {
      name: "scheduleShipping",
      execute: async (ctx) => {
        await services.scheduleShipping(ctx);
        ctx.shipped = true;
      },
      compensate: async (_ctx) => {
        // 取消发货通常不需要补偿，发货前会被拦截
        // 如果已经发货，需要执行退货流程（更复杂）
      },
    },
  ];
}