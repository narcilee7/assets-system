/**
 * Layered Service Blueprint：订单服务示例。
 *
 * 展示：Controller → Service → Repository 的分层组织。
 * 重点：依赖倒置、DTO 转换、错误处理、事务边界。
 */

import { randomUUID } from "crypto";

/* ------------------------------------------------------------------ */
/*  Domain Types                                                       */
/* ------------------------------------------------------------------ */

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/*  DTOs                                                               */
/* ------------------------------------------------------------------ */

export interface CreateOrderRequest {
  userId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface OrderResponse {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

/* ------------------------------------------------------------------ */
/*  Errors                                                             */
/* ------------------------------------------------------------------ */

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`);
    this.name = "OrderNotFoundError";
  }
}

export class InvalidOrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrderStateError";
  }
}

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

/* ------------------------------------------------------------------ */
/*  Repository Interface（依赖倒置）                                   */
/* ------------------------------------------------------------------ */

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  update(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

export interface OrderServiceOptions {
  maxItemsPerOrder?: number;
  allowNegativeQuantity?: boolean;
}

export class OrderService {
  constructor(
    private repository: OrderRepository,
    private options: OrderServiceOptions = {}
  ) {}

  /**
   * 创建订单。
   * 事务边界：整个创建过程在一个事务内。
   */
  async createOrder(req: CreateOrderRequest): Promise<Order> {
    // 1. 业务校验
    this.validateCreateRequest(req);

    // 2. 计算总价
    const totalAmount = req.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // 3. 构建领域对象
    const now = Date.now();
    const order: Order = {
      id: randomUUID(),
      userId: req.userId,
      items: req.items.map((item) => ({ ...item })),
      totalAmount,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    // 4. 持久化（事务边界）
    await this.repository.save(order);

    return order;
  }

  /**
   * 获取订单。
   */
  async getOrder(orderId: string): Promise<Order> {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }
    return order;
  }

  /**
   * 获取用户的所有订单。
   */
  async getUserOrders(userId: string): Promise<Order[]> {
    return this.repository.findByUserId(userId);
  }

  /**
   * 更新订单状态。
   * 状态机：pending → paid → shipped → delivered
   *        pending → cancelled
   */
  async updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<Order> {
    const order = await this.getOrder(orderId);

    // 状态机校验
    this.validateStatusTransition(order.status, newStatus);

    // 更新状态
    const updatedOrder: Order = {
      ...order,
      status: newStatus,
      updatedAt: Date.now(),
    };

    await this.repository.update(updatedOrder);

    return updatedOrder;
  }

  /**
   * 取消订单。
   */
  async cancelOrder(orderId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, "cancelled");
  }

  /**
   * 删除订单（物理删除，仅用于测试）。
   */
  async deleteOrder(orderId: string): Promise<void> {
    const order = await this.getOrder(orderId);
    if (order.status !== "pending" && order.status !== "cancelled") {
      throw new InvalidOrderStateError(
        `Cannot delete order in status: ${order.status}`
      );
    }
    await this.repository.delete(orderId);
  }

  /* ------------------------------------------------------------------ */
  /*  业务校验                                                           */
  /* ------------------------------------------------------------------ */

  private validateCreateRequest(req: CreateOrderRequest): void {
    if (!req.userId) {
      throw new OrderValidationError("userId is required");
    }

    if (!req.items || req.items.length === 0) {
      throw new OrderValidationError("items cannot be empty");
    }

    const maxItems = this.options.maxItemsPerOrder ?? 100;
    if (req.items.length > maxItems) {
      throw new OrderValidationError(
        `items cannot exceed ${maxItems} per order`
      );
    }

    for (const item of req.items) {
      if (!item.productId) {
        throw new OrderValidationError("productId is required");
      }
      if (item.quantity <= 0) {
        throw new OrderValidationError("quantity must be positive");
      }
      if (item.unitPrice < 0) {
        throw new OrderValidationError("unitPrice cannot be negative");
      }
    }
  }

  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus
  ): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ["paid", "cancelled"],
      paid: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    const allowed = validTransitions[currentStatus];
    if (!allowed.includes(newStatus)) {
      throw new InvalidOrderStateError(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Controller                                                         */
/* ------------------------------------------------------------------ */

export interface HttpContext {
  request: Record<string, unknown>;
  params: Record<string, string>;
}

export type NextFn = () => Promise<void>;

export type ControllerHandler = (
  ctx: HttpContext,
  next: NextFn
) => Promise<Response>;

/**
 * HTTP 错误映射表。
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  OrderNotFoundError: 404,
  InvalidOrderStateError: 409,
  OrderValidationError: 400,
};

/**
 * DTO 转换器。
 */
export function orderToResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    userId: order.userId,
    items: order.items,
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: new Date(order.createdAt).toISOString(),
    updatedAt: new Date(order.updatedAt).toISOString(),
  };
}

export class OrderController {
  constructor(private service: OrderService) {}

  /**
   * GET /orders/:id
   */
  getOrder: ControllerHandler = async (ctx) => {
    const order = await this.service.getOrder(ctx.params.id);
    return {
      status: 200,
      body: orderToResponse(order),
    };
  };

  /**
   * GET /orders?userId=xxx
   */
  getUserOrders: ControllerHandler = async (ctx) => {
    const userId = ctx.request.userId as string;
    if (!userId) {
      return { status: 400, body: { error: "userId is required" } };
    }
    const orders = await this.service.getUserOrders(userId);
    return {
      status: 200,
      body: orders.map(orderToResponse),
    };
  };

  /**
   * POST /orders
   */
  createOrder: ControllerHandler = async (ctx) => {
    const req = ctx.request as unknown as CreateOrderRequest;
    const order = await this.service.createOrder(req);
    return {
      status: 201,
      body: orderToResponse(order),
    };
  };

  /**
   * PATCH /orders/:id/status
   */
  updateOrderStatus: ControllerHandler = async (ctx) => {
    const req = ctx.request as unknown as UpdateOrderStatusRequest;
    const order = await this.service.updateOrderStatus(
      ctx.params.id,
      req.status
    );
    return {
      status: 200,
      body: orderToResponse(order),
    };
  };

  /**
   * DELETE /orders/:id
   */
  deleteOrder: ControllerHandler = async (ctx) => {
    await this.service.deleteOrder(ctx.params.id);
    return { status: 204, body: null };
  };

  /**
   * 错误处理中间件。
   * 将领域错误映射为 HTTP 状态码。
   */
  errorHandler: ControllerHandler = async (ctx, next) => {
    try {
      return await next();
    } catch (err) {
      if (err instanceof Error) {
        const status = ERROR_STATUS_MAP[err.name] ?? 500;
        return {
          status,
          body: { error: err.message, name: err.name },
        };
      }
      return { status: 500, body: { error: "Unknown error" } };
    }
  };
}

/* ------------------------------------------------------------------ */
/*  In-Memory Repository（测试用）                                    */
/* ------------------------------------------------------------------ */

export class InMemoryOrderRepository implements OrderRepository {
  private orders = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, { ...order });
  }

  async update(order: Order): Promise<void> {
    if (!this.orders.has(order.id)) {
      throw new OrderNotFoundError(order.id);
    }
    this.orders.set(order.id, { ...order });
  }

  async delete(id: string): Promise<void> {
    this.orders.delete(id);
  }

  clear(): void {
    this.orders.clear();
  }

  getAll(): Order[] {
    return Array.from(this.orders.values());
  }
}

/* ------------------------------------------------------------------ */
/*  路由器（简化版）                                                   */
/* ------------------------------------------------------------------ */

export interface Route {
  method: string;
  path: string;
  handler: ControllerHandler;
}

export class Router {
  private routes: Route[] = [];

  get(path: string, handler: ControllerHandler): void {
    this.routes.push({ method: "GET", path, handler });
  }

  post(path: string, handler: ControllerHandler): void {
    this.routes.push({ method: "POST", path, handler });
  }

  patch(path: string, handler: ControllerHandler): void {
    this.routes.push({ method: "PATCH", path, handler });
  }

  delete(path: string, handler: ControllerHandler): void {
    this.routes.push({ method: "DELETE", path, handler });
  }

  match(method: string, path: string): ControllerHandler | null {
    const route = this.routes.find(
      (r) => r.method === method && r.path === path
    );
    return route?.handler ?? null;
  }
}