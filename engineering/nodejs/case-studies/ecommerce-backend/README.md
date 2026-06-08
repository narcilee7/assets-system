# E-commerce Backend Case Study

一个完整的 Node.js 电商后端案例，演示模块化架构、事务、缓存、队列和可观测性的综合应用。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Framework | NestJS |
| ORM | Prisma + PostgreSQL |
| Cache | Redis (ioredis) |
| Queue | BullMQ |
| Auth | JWT + RBAC |
| API | REST + Zod 校验 |
| Test | Vitest + Supertest |
| Deploy | Docker + PM2 |

## 模块结构

```
ecommerce-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── prisma.ts
│   ├── common/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── decorators/
│   ├── modules/
│   │   ├── user/
│   │   ├── product/
│   │   ├── order/
│   │   └── payment/
│   └── config/
└── docker-compose.yml
```

## 核心流程

### 下单流程

```
[Client] POST /orders
    -> AuthGuard (JWT 校验)
    -> ZodValidationPipe (参数校验)
    -> OrderController
    -> OrderService
        -> Prisma $transaction
            -> 扣减库存 (ProductService)
            -> 创建订单 (OrderRepository)
            -> 扣减余额 (UserService)
        -> PaymentService.createCharge
        -> BullMQ 发送确认邮件
    <- OrderResponseDto
```

### 关键代码

```ts
// modules/order/order.service.ts
@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private productService: ProductService,
    private userService: UserService,
    private paymentService: PaymentService,
    private emailQueue: EmailQueue,
  ) {}

  async placeOrder(userId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await this.productService.decrementStock(tx, dto.productId, dto.quantity);
      const total = product.price * dto.quantity;
      const user = await this.userService.decrementBalance(tx, userId, total);
      const order = await tx.order.create({
        data: { userId, productId: dto.productId, quantity: dto.quantity, total, status: 'PENDING' },
      });
      return order;
    });
  }

  async confirmPayment(orderId: string, paymentId: string) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAID', paymentId },
    });
    await this.emailQueue.add('order-confirmed', { orderId, email: order.user.email });
    return order;
  }
}
```

## 部署

```bash
docker-compose up -d db redis
npm run migrate
npm run build
pm2 start ecosystem.config.js
```

## 学习要点

- 事务边界：库存、余额、订单必须在同一事务内。
- 异步解耦：邮件发送通过 BullMQ 异步处理，不影响下单响应时间。
- 幂等性：支付回调使用 `paymentId` 做幂等校验。
- 可观测性：每个请求携带 traceId，链路贯穿 Controller -> Service -> DB -> Queue。
