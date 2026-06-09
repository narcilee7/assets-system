# CQRS (Command Query Responsibility Segregation)

CQRS 将读模型和写模型分离，让两者独立优化、独立扩展。

## 核心思想

```
         Command (写)
            |
            v
      [Command Handler]
            |
            v
      [Write Model / Aggregate]
            |
            +----> Event Store
            |
            v
      [Event Publisher]
            |
            +----> [Projection] ----> [Read Model]
                                             |
                                             v
                                         Query (读)
```

## 核心实现

### 1. Command Side

```ts
// commands.ts
interface Command {
  type: string;
  payload: any;
  metadata: { userId: string; timestamp: Date; correlationId: string };
}

class PlaceOrderCommand implements Command {
  type = 'PlaceOrder';
  constructor(
    public payload: { userId: string; items: OrderItem[] },
    public metadata: any,
  ) {}
}

class CommandHandler {
  constructor(private eventStore: EventStore, private publisher: EventPublisher) {}

  async handle(command: Command) {
    switch (command.type) {
      case 'PlaceOrder': {
        const aggregate = new OrderAggregate(crypto.randomUUID());
        aggregate.placeOrder(command.payload.items);

        for (const event of aggregate.uncommittedEvents) {
          await this.eventStore.append(event);
          await this.publisher.publish(event);
        }
        break;
      }
    }
  }
}
```

### 2. Query Side

```ts
// queries.ts
interface Query {
  type: string;
  filters: any;
}

class QueryHandler {
  async handle(query: Query) {
    switch (query.type) {
      case 'GetOrderById':
        return db('order_read').where({ id: query.filters.id }).first();
      case 'SearchOrders':
        return db('order_read')
          .where(query.filters)
          .orderBy('created_at', 'desc')
          .limit(query.filters.limit || 20);
      case 'GetOrderStats':
        return db('order_read')
          .select('status')
          .count('* as count')
          .sum('total as revenue')
          .groupBy('status');
    }
  }
}
```

### 3. Projection（同步读模型）

```ts
// projection.ts
class OrderProjection {
  async project(event: DomainEvent) {
    switch (event.type) {
      case 'OrderPlaced':
        await this.projectOrderPlaced(event);
        break;
      case 'OrderPaid':
        await this.projectOrderPaid(event);
        break;
      case 'OrderCancelled':
        await this.projectOrderCancelled(event);
        break;
    }
  }

  private async projectOrderPlaced(event: DomainEvent) {
    // 写入订单读模型
    await db('orders').insert({
      id: event.aggregateId,
      user_id: event.payload.userId,
      status: 'placed',
      total: event.payload.total,
      created_at: event.timestamp,
    });

    // 写入用户订单索引（加速查询）
    await db('user_orders').insert({
      user_id: event.payload.userId,
      order_id: event.aggregateId,
      total: event.payload.total,
      created_at: event.timestamp,
    });
  }
}
```

## CQRS + Event Sourcing vs CQRS + CRUD

| 组合 | 写模型 | 读模型 | 适用 |
| --- | --- | --- | --- |
| CQRS + ES | 事件存储 | 事件投影 | 高审计、复杂业务 |
| CQRS + CRUD | 关系数据库 | 物化视图 / 搜索引擎 | 读多写少、简单业务 |

## 最终一致性

CQRS 中读写模型是最终一致的，需业务容忍：

```ts
// 命令后查询可能看不到最新数据
await commandBus.send(new PlaceOrderCommand(...));

// 方案1：轮询等待
await waitFor(async () => {
  const order = await queryBus.query(new GetOrderByIdQuery(orderId));
  return order?.status === 'placed';
}, { timeout: 5000 });

// 方案2：Command 返回预估读模型
const result = await commandBus.send(command); // { orderId, estimatedReadModel }
```

## 反模式

- **为 CQRS 而 CQRS**：简单 CRUD 系统不需要 CQRS。
- **读模型过度复杂**：读模型应为查询优化，不要试图复用写模型逻辑。
- **忽略一致性**：不处理最终一致性导致的用户体验问题。
