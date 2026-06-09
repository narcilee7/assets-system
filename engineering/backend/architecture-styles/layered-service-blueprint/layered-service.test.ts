/**
 * Layered Service Blueprint 测试。
 *
 * 运行：在 engineering/backend/ 目录执行 `npm test`
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  OrderService,
  OrderController,
  InMemoryOrderRepository,
  orderToResponse,
  OrderNotFoundError,
  InvalidOrderStateError,
  OrderValidationError,
  type CreateOrderRequest,
  type OrderStatus,
} from "./impl.js";

/* ------------------------------------------------------------------ */
/*  OrderService 测试                                                 */
/* ------------------------------------------------------------------ */

describe("OrderService", () => {
  let repository: InMemoryOrderRepository;
  let service: OrderService;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
    service = new OrderService(repository);
  });

  describe("createOrder", () => {
    it("创建订单并计算总价", async () => {
      const req: CreateOrderRequest = {
        userId: "u1",
        items: [
          { productId: "p1", productName: "Apple", quantity: 2, unitPrice: 100 },
          { productId: "p2", productName: "Banana", quantity: 3, unitPrice: 50 },
        ],
      };

      const order = await service.createOrder(req);

      assert.strictEqual(order.userId, "u1");
      assert.strictEqual(order.status, "pending");
      assert.strictEqual(order.totalAmount, 350); // 2*100 + 3*50
      assert.strictEqual(order.items.length, 2);
      assert.ok(order.id);
    });

    it("空 items 抛出错误", async () => {
      const req = { userId: "u1", items: [] };

      await assert.rejects(
        () => service.createOrder(req as CreateOrderRequest),
        OrderValidationError
      );
    });

    it("负数 quantity 抛出错误", async () => {
      const req = {
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: -1, unitPrice: 100 }],
      };

      await assert.rejects(
        () => service.createOrder(req as CreateOrderRequest),
        OrderValidationError
      );
    });

    it("负数 unitPrice 抛出错误", async () => {
      const req = {
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: -100 }],
      };

      await assert.rejects(
        () => service.createOrder(req as CreateOrderRequest),
        OrderValidationError
      );
    });

    it("缺少 userId 抛出错误", async () => {
      const req = {
        userId: "",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      };

      await assert.rejects(
        () => service.createOrder(req as CreateOrderRequest),
        OrderValidationError
      );
    });
  });

  describe("getOrder", () => {
    it("返回存在的订单", async () => {
      const req: CreateOrderRequest = {
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      };
      const created = await service.createOrder(req);

      const order = await service.getOrder(created.id);

      assert.strictEqual(order.id, created.id);
      assert.strictEqual(order.userId, "u1");
    });

    it("不存在的订单抛出 404", async () => {
      await assert.rejects(
        () => service.getOrder("non-existent-id"),
        OrderNotFoundError
      );
    });
  });

  describe("getUserOrders", () => {
    it("返回用户的所有订单", async () => {
      await service.createOrder({
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      });
      await service.createOrder({
        userId: "u1",
        items: [{ productId: "p2", productName: "Banana", quantity: 2, unitPrice: 50 }],
      });
      await service.createOrder({
        userId: "u2",
        items: [{ productId: "p3", productName: "Orange", quantity: 3, unitPrice: 30 }],
      });

      const orders = await service.getUserOrders("u1");

      assert.strictEqual(orders.length, 2);
      assert.ok(orders.every((o) => o.userId === "u1"));
    });

    it("无订单返回空数组", async () => {
      const orders = await service.getUserOrders("non-existent-user");
      assert.strictEqual(orders.length, 0);
    });
  });

  describe("updateOrderStatus", () => {
    it("pending → paid 成功", async () => {
      const order = await service.createOrder({
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      });

      const updated = await service.updateOrderStatus(order.id, "paid");

      assert.strictEqual(updated.status, "paid");
    });

    it("pending → delivered 失败（非法转换）", async () => {
      const order = await service.createOrder({
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      });

      await assert.rejects(
        () => service.updateOrderStatus(order.id, "delivered"),
        InvalidOrderStateError
      );
    });

    it("delivered → 任何状态 失败（终态）", async () => {
      const order = await service.createOrder({
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      });
      await service.updateOrderStatus(order.id, "paid");
      await service.updateOrderStatus(order.id, "shipped");
      await service.updateOrderStatus(order.id, "delivered");

      await assert.rejects(
        () => service.updateOrderStatus(order.id, "cancelled"),
        InvalidOrderStateError
      );
    });
  });

  describe("cancelOrder", () => {
    it("pending 订单可以取消", async () => {
      const order = await service.createOrder({
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      });

      const cancelled = await service.cancelOrder(order.id);

      assert.strictEqual(cancelled.status, "cancelled");
    });

    it("shipped 订单不能取消", async () => {
      const order = await service.createOrder({
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      });
      await service.updateOrderStatus(order.id, "paid");
      await service.updateOrderStatus(order.id, "shipped");

      await assert.rejects(
        () => service.cancelOrder(order.id),
        InvalidOrderStateError
      );
    });
  });

  describe("deleteOrder", () => {
    it("pending 订单可以删除", async () => {
      const order = await service.createOrder({
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      });

      await service.deleteOrder(order.id);

      await assert.rejects(
        () => service.getOrder(order.id),
        OrderNotFoundError
      );
    });

    it("paid 订单不能删除", async () => {
      const order = await service.createOrder({
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      });
      await service.updateOrderStatus(order.id, "paid");

      await assert.rejects(
        () => service.deleteOrder(order.id),
        InvalidOrderStateError
      );
    });
  });
});

/* ------------------------------------------------------------------ */
/*  OrderController 测试                                              */
/* ------------------------------------------------------------------ */

describe("OrderController", () => {
  let repository: InMemoryOrderRepository;
  let service: OrderService;
  let controller: OrderController;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
    service = new OrderService(repository);
    controller = new OrderController(service);
  });

  describe("errorHandler", () => {
    it("OrderNotFoundError → 404", async () => {
      const ctx = { request: {}, params: { id: "non-existent" } };
      let thrownError: Error | null = null;

      const response = await controller.errorHandler(ctx, async () => {
        throw new OrderNotFoundError("non-existent");
      });

      assert.strictEqual(response.status, 404);
    });

    it("OrderValidationError → 400", async () => {
      const ctx = { request: {}, params: {} };
      const response = await controller.errorHandler(ctx, async () => {
        throw new OrderValidationError("Invalid input");
      });

      assert.strictEqual(response.status, 400);
    });

    it("InvalidOrderStateError → 409", async () => {
      const ctx = { request: {}, params: {} };
      const response = await controller.errorHandler(ctx, async () => {
        throw new InvalidOrderStateError("Invalid state");
      });

      assert.strictEqual(response.status, 409);
    });

    it("未知错误 → 500", async () => {
      const ctx = { request: {}, params: {} };
      const response = await controller.errorHandler(ctx, async () => {
        throw new Error("Unknown");
      });

      assert.strictEqual(response.status, 500);
    });

    it("正常流程不拦截", async () => {
      const ctx = { request: {}, params: {} };
      const response = await controller.errorHandler(ctx, async () => ({
        status: 200,
        body: { ok: true },
      }));

      assert.strictEqual(response.status, 200);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  DTO 转换测试                                                       */
/* ------------------------------------------------------------------ */

describe("orderToResponse", () => {
  it("转换日期为 ISO 字符串", () => {
    const order = {
      id: "o1",
      userId: "u1",
      items: [{ productId: "p1", productName: "Apple", quantity: 1, unitPrice: 100 }],
      totalAmount: 100,
      status: "pending" as OrderStatus,
      createdAt: new Date("2024-01-01T00:00:00Z").getTime(),
      updatedAt: new Date("2024-01-01T00:00:00Z").getTime(),
    };

    const response = orderToResponse(order);

    assert.strictEqual(response.createdAt, "2024-01-01T00:00:00.000Z");
    assert.strictEqual(response.updatedAt, "2024-01-01T00:00:00.000Z");
  });
});

/* ------------------------------------------------------------------ */
/*  集成测试                                                           */
/* ------------------------------------------------------------------ */

describe("集成：完整分层调用链", () => {
  it("Controller → Service → Repository", async () => {
    const repository = new InMemoryOrderRepository();
    const service = new OrderService(repository);
    const controller = new OrderController(service);

    // 1. Controller 创建订单
    const createResponse = await controller.createOrder(
      { request: {
        userId: "u1",
        items: [{ productId: "p1", productName: "Apple", quantity: 2, unitPrice: 100 }],
      }, params: {} },
      async () => ({ status: 200, body: {} })
    );

    assert.strictEqual(createResponse.status, 201);
    const created = createResponse.body as { id: string };

    // 2. Controller 获取订单
    const getResponse = await controller.getOrder(
      { request: {}, params: { id: created.id } },
      async () => ({ status: 200, body: {} })
    );

    assert.strictEqual(getResponse.status, 200);

    // 3. Repository 直接验证
    const allOrders = repository.getAll();
    assert.strictEqual(allOrders.length, 1);
    assert.strictEqual(allOrders[0].userId, "u1");
  });
});