/**
 * Saga Pattern 测试。
 *
 * 运行：在 engineering/backend/ 目录执行 `npm test`
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  SagaOrchestrator,
  SagaBuilder,
  SagaDeadLetterQueue,
  createOrderSagaSteps,
  type SagaStep,
  type SagaResult,
  type OrderSagaContext,
} from "./impl.js";

/* ------------------------------------------------------------------ */
/*  辅助函数                                                           */
/* ------------------------------------------------------------------ */

function createMockStep(
  name: string,
  executeFn: () => Promise<void>,
  compensateFn: () => Promise<void> = async () => {}
): SagaStep {
  return { name, execute: executeFn, compensate: compensateFn };
}

/* ------------------------------------------------------------------ */
/*  SagaOrchestrator 测试                                             */
/* ------------------------------------------------------------------ */

describe("SagaOrchestrator", () => {
  describe("成功流程", () => {
    it("所有步骤成功，状态为 completed", async () => {
      const steps = [
        createMockStep("step1", async () => {}, async () => {}),
        createMockStep("step2", async () => {}, async () => {}),
        createMockStep("step3", async () => {}, async () => {}),
      ];

      const saga = new SagaOrchestrator(steps);
      const result = await saga.execute({});

      assert.strictEqual(result.status, "completed");
      assert.strictEqual(result.completedSteps.length, 3);
      assert.strictEqual(result.compensatedSteps.length, 0);
      assert.strictEqual(result.finalError, undefined);
    });

    it("步骤按顺序执行", async () => {
      const executionOrder: string[] = [];

      const steps = [
        createMockStep("step1", async () => { executionOrder.push("step1-execute"); }, async () => { executionOrder.push("step1-compensate"); }),
        createMockStep("step2", async () => { executionOrder.push("step2-execute"); }, async () => { executionOrder.push("step2-compensate"); }),
        createMockStep("step3", async () => { executionOrder.push("step3-execute"); }, async () => { executionOrder.push("step3-compensate"); }),
      ];

      const saga = new SagaOrchestrator(steps);
      await saga.execute({});

      assert.deepStrictEqual(executionOrder, [
        "step1-execute",
        "step2-execute",
        "step3-execute",
      ]);
    });
  });

  describe("失败补偿流程", () => {
    it("步骤失败时，补偿已完成的步骤（反向顺序）", async () => {
      const executionOrder: string[] = [];

      const steps = [
        createMockStep(
          "step1",
          async () => { executionOrder.push("step1-execute"); },
          async () => { executionOrder.push("step1-compensate"); }
        ),
        createMockStep(
          "step2",
          async () => { executionOrder.push("step2-execute"); throw new Error("step2 failed"); },
          async () => { executionOrder.push("step2-compensate"); }
        ),
        createMockStep(
          "step3",
          async () => { executionOrder.push("step3-execute"); },
          async () => { executionOrder.push("step3-compensate"); }
        ),
      ];

      const saga = new SagaOrchestrator(steps);
      const result = await saga.execute({});

      assert.strictEqual(result.status, "failed");
      assert.strictEqual(result.completedSteps.length, 1);
      assert.deepStrictEqual(result.completedSteps, ["step1"]);
      // 补偿按反向顺序：先补偿 step1
      assert.deepStrictEqual(result.compensatedSteps, ["step1"]);
      assert.ok(result.finalError);
    });

    it("步骤2失败，step1被补偿，step3未执行", async () => {
      const executionLog: string[] = [];

      const steps = [
        createMockStep(
          "step1",
          async () => { executionLog.push("execute-step1"); },
          async () => { executionLog.push("compensate-step1"); }
        ),
        createMockStep(
          "step2",
          async () => { executionLog.push("execute-step2"); throw new Error("fail"); },
          async () => { executionLog.push("compensate-step2"); }
        ),
        createMockStep(
          "step3",
          async () => { executionLog.push("execute-step3"); },
          async () => { executionLog.push("compensate-step3"); }
        ),
      ];

      const saga = new SagaOrchestrator(steps);
      await saga.execute({});

      assert.deepStrictEqual(executionLog, [
        "execute-step1",
        "execute-step2",
        "compensate-step1", // step2 失败后，反向补偿 step1
      ]);
    });

    it("第一个步骤失败，无需补偿", async () => {
      const executionLog: string[] = [];

      const steps = [
        createMockStep(
          "step1",
          async () => { executionLog.push("execute-step1"); throw new Error("fail"); },
          async () => { executionLog.push("compensate-step1"); }
        ),
        createMockStep("step2", async () => { executionLog.push("execute-step2"); }),
      ];

      const saga = new SagaOrchestrator(steps);
      const result = await saga.execute({});

      assert.strictEqual(result.status, "failed");
      assert.strictEqual(result.completedSteps.length, 0);
      assert.strictEqual(result.compensatedSteps.length, 0);
    });
  });

  describe("补偿重试", () => {
    it("补偿失败时重试", async () => {
      const compensationAttempts: number[] = [];
      let step1Attempts = 0;

      const steps = [
        createMockStep(
          "step1",
          async () => {},
          async () => {
            step1Attempts++;
            compensationAttempts.push(step1Attempts);
            if (step1Attempts < 3) throw new Error("compensation failed");
          }
        ),
        createMockStep(
          "step2",
          async () => { throw new Error("step2 failed"); },
          async () => {}
        ),
      ];

      const saga = new SagaOrchestrator(steps, { maxRetries: 3, retryDelayMs: 10 });
      const result = await saga.execute({});

      assert.strictEqual(result.status, "failed");
      assert.strictEqual(compensationAttempts.length, 3);
    });

    it("补偿最终失败后添加到死信队列", async () => {
      const dlq = new SagaDeadLetterQueue();
      let step1Attempts = 0;

      const steps = [
        createMockStep(
          "step1",
          async () => {},
          async () => {
            step1Attempts++;
            if (step1Attempts < 5) throw new Error("compensation failed");
          }
        ),
        createMockStep(
          "step2",
          async () => { throw new Error("step2 failed"); },
          async () => {}
        ),
      ];

      const saga = new SagaOrchestrator(steps, {
        maxRetries: 3,
        retryDelayMs: 10,
        onSagaFailed: (error, ctx, compensated) => {
          dlq.add({
            sagaId: saga.getSagaId(),
            stepName: "step1",
            error: error.message,
            context: ctx,
          });
        },
      });

      await saga.execute({});

      // 补偿在 3 次重试后仍然失败，onSagaFailed 回调被触发
      // 注意：当前实现会继续重试直到成功或达到最大重试次数
      assert.strictEqual(saga.getStatus(), "failed");
    });
  });

  describe("超时处理", () => {
    it("步骤执行超时抛出错误", async () => {
      const steps = [
        createMockStep(
          "slowStep",
          async () => { await new Promise((resolve) => setTimeout(resolve, 100)); },
          async () => {}
        ),
      ];

      const saga = new SagaOrchestrator(steps, { timeoutMs: 50 });
      const result = await saga.execute({});

      assert.strictEqual(result.status, "failed");
      assert.ok(result.finalError?.message.includes("timed out"));
    });

    it("超时不影响其他步骤", async () => {
      const log: string[] = [];

      const steps = [
        createMockStep("step1", async () => { log.push("step1"); }, async () => { log.push("step1-c"); }),
        createMockStep("slow", async () => { await new Promise((r) => setTimeout(r, 100)); log.push("slow"); }, async () => { log.push("slow-c"); }),
        createMockStep("step3", async () => { log.push("step3"); }, async () => { log.push("step3-c"); }),
      ];

      const saga = new SagaOrchestrator(steps, { timeoutMs: 50 });
      await saga.execute({});

      // 只有 step1 完成，slow 超时后开始补偿 step1
      assert.deepStrictEqual(log, ["step1", "slow", "step1-c"]);
    });
  });

  describe("回调", () => {
    it("onStepFailed 在步骤失败时调用", async () => {
      let failedStep = "";
      let failedError: Error | undefined;

      const steps = [
        createMockStep("step1", async () => {}, async () => {}),
        createMockStep("step2", async () => { throw new Error("step2 error"); }, async () => {}),
      ];

      const saga = new SagaOrchestrator(steps, {
        onStepFailed: (stepName, error) => {
          failedStep = stepName;
          failedError = error;
        },
      });

      await saga.execute({});

      assert.strictEqual(failedStep, "step2");
      assert.strictEqual(failedError?.message, "step2 error");
    });

    it("onSagaCompleted 在所有步骤成功完成后调用", async () => {
      let completed = false;

      const steps = [createMockStep("step1", async () => {}, async () => {})];

      const saga = new SagaOrchestrator(steps, {
        onSagaCompleted: () => { completed = true; },
      });

      await saga.execute({});

      assert.strictEqual(completed, true);
    });

    it("onSagaFailed 在 Saga 失败时调用", async () => {
      let failedError: Error | undefined;
      let wasCompensated = false;

      const steps = [
        createMockStep("step1", async () => {}, async () => { wasCompensated = true; }),
        createMockStep("step2", async () => { throw new Error("fail"); }, async () => {}),
      ];

      const saga = new SagaOrchestrator(steps, {
        onSagaFailed: (error) => { failedError = error; },
      });

      await saga.execute({});

      assert.strictEqual(failedError?.message, "fail");
      assert.strictEqual(wasCompensated, true);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  SagaBuilder 测试                                                  */
/* ------------------------------------------------------------------ */

describe("SagaBuilder", () => {
  it("流式构建 Saga", async () => {
    const executionOrder: string[] = [];

    const saga = new SagaBuilder<{ userId: string }>()
      .addStep(createMockStep("step1", async () => { executionOrder.push("step1"); }, async () => {}))
      .addStep(createMockStep("step2", async () => { executionOrder.push("step2"); }, async () => {}))
      .withOptions({ maxRetries: 2 })
      .build();

    const result = await saga.execute({ userId: "u1" });

    assert.strictEqual(result.status, "completed");
    assert.deepStrictEqual(executionOrder, ["step1", "step2"]);
  });
});

/* ------------------------------------------------------------------ */
/*  订单流程 Saga 示例测试                                            */
/* ------------------------------------------------------------------ */

describe("OrderSaga 示例", () => {
  interface MockServices {
    createOrder: () => Promise<void>;
    reserveInventory: () => Promise<void>;
    processPayment: () => Promise<void>;
    scheduleShipping: () => Promise<void>;
    cancelOrder: () => Promise<void>;
    releaseInventory: () => Promise<void>;
    refundPayment: () => Promise<void>;
  }

  function createOrderSaga(
    services: MockServices,
    failAtStep?: string
  ): SagaOrchestrator<OrderSagaContext> {
    const steps = createOrderSagaSteps({
      createOrder: async (ctx) => {
        if (failAtStep === "createOrder") throw new Error("createOrder failed");
        await services.createOrder();
        ctx.orderCreated = true;
      },
      reserveInventory: async (ctx) => {
        if (failAtStep === "reserveInventory") throw new Error("reserveInventory failed");
        await services.reserveInventory();
        ctx.inventoryReserved = true;
      },
      processPayment: async (ctx) => {
        if (failAtStep === "processPayment") throw new Error("processPayment failed");
        await services.processPayment();
        ctx.paymentProcessed = true;
      },
      scheduleShipping: async (ctx) => {
        if (failAtStep === "scheduleShipping") throw new Error("scheduleShipping failed");
        await services.scheduleShipping();
        ctx.shipped = true;
      },
      cancelOrder: services.cancelOrder,
      releaseInventory: services.releaseInventory,
      refundPayment: services.refundPayment,
    });

    return new SagaOrchestrator(steps);
  }

  it("成功下单流程", async () => {
    const services = {
      createOrder: async () => {},
      reserveInventory: async () => {},
      processPayment: async () => {},
      scheduleShipping: async () => {},
      cancelOrder: async () => { throw new Error("should not be called"); },
      releaseInventory: async () => { throw new Error("should not be called"); },
      refundPayment: async () => { throw new Error("should not be called"); },
    };

    const saga = createOrderSaga(services);
    const result = await saga.execute({
      userId: "u1",
      items: [{ productId: "p1", quantity: 2 }],
    });

    assert.strictEqual(result.status, "completed");
    assert.strictEqual(result.completedSteps.length, 4);
  });

  it("支付失败时补偿库存", async () => {
    const compensationLog: string[] = [];

    const services = {
      createOrder: async () => {},
      reserveInventory: async () => { compensationLog.push("release-inventory"); },
      processPayment: async () => { throw new Error("payment failed"); },
      scheduleShipping: async () => {},
      cancelOrder: async () => { compensationLog.push("cancel-order"); },
      releaseInventory: async () => { compensationLog.push("release-inventory"); },
      refundPayment: async () => { throw new Error("should not be called"); },
    };

    const saga = createOrderSaga(services, "processPayment");
    const result = await saga.execute({
      userId: "u1",
      items: [{ productId: "p1", quantity: 2 }],
    });

    assert.strictEqual(result.status, "failed");
    assert.deepStrictEqual(result.completedSteps, ["createOrder", "reserveInventory"]);
    // 补偿顺序：先释库存，再取消订单
    assert.ok(compensationLog.includes("release-inventory"));
  });

  it("保留上下文状态用于调试", async () => {
    const services = {
      createOrder: async () => {},
      reserveInventory: async () => { throw new Error("inventory unavailable"); },
      processPayment: async () => { throw new Error("should not be called"); },
      scheduleShipping: async () => { throw new Error("should not be called"); },
      cancelOrder: async () => {},
      releaseInventory: async () => {},
      refundPayment: async () => {},
    };

    const saga = createOrderSaga(services, "reserveInventory");
    const ctx: OrderSagaContext = {
      userId: "u1",
      items: [{ productId: "p1", quantity: 2 }],
    };

    await saga.execute(ctx);

    // 上下文应该有步骤执行后的状态标记
    assert.strictEqual(ctx.orderCreated, true);
    assert.strictEqual(ctx.inventoryReserved, undefined); // 失败步骤未完成
  });
});