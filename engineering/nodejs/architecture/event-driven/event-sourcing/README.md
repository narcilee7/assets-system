# Event Sourcing

事件溯源是将系统状态的所有变更记录为不可变事件序列，状态是当前事件序列的投影。

## 核心概念

```
Commands -> Events -> Event Store -> Projections (Read Model)
   |          |          |             |
   v          v          v             v
 验证      不可变      顺序存储      物化视图
```

| 概念 | 说明 |
| --- | --- |
| Command | 用户意图，如 "PlaceOrder" |
| Event | 已发生的事实，如 "OrderPlaced" |
| Aggregate | 业务实体，维护自身的不变量 |
| Event Store | 事件持久化存储 |
| Projection | 从事件重建的读取模型 |

## 核心实现

### 1. Event Store（PostgreSQL 实现）

```ts
// event-store.ts
interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  type: string;
  payload: any;
  version: number;
  timestamp: Date;
}

class EventStore {
  async append(event: DomainEvent): Promise<void> {
    await db.transaction(async (trx) => {
      // 乐观锁：检查版本号
      const currentVersion = await trx('events')
        .where({ aggregate_id: event.aggregateId })
        .max('version as max')
        .first();

      if (currentVersion?.max !== event.version - 1) {
        throw new Error('Concurrency conflict');
      }

      await trx('events').insert({
        id: event.id,
        aggregate_id: event.aggregateId,
        aggregate_type: event.aggregateType,
        type: event.type,
        payload: JSON.stringify(event.payload),
        version: event.version,
        timestamp: event.timestamp,
      });
    });
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const rows = await db('events')
      .where({ aggregate_id: aggregateId })
      .orderBy('version', 'asc');

    return rows.map((r) => ({
      id: r.id,
      aggregateId: r.aggregate_id,
      aggregateType: r.aggregate_type,
      type: r.type,
      payload: JSON.parse(r.payload),
      version: r.version,
      timestamp: r.timestamp,
    }));
  }
}
```

### 2. Aggregate（订单聚合）

```ts
// order.aggregate.ts
class OrderAggregate {
  private events: DomainEvent[] = [];
  private state: OrderState = { status: 'draft', items: [], total: 0 };

  constructor(public readonly id: string) {}

  placeOrder(items: OrderItem[]) {
    if (this.state.status !== 'draft') {
      throw new Error('Order already placed');
    }
    this.apply({
      id: crypto.randomUUID(),
      aggregateId: this.id,
      aggregateType: 'order',
      type: 'OrderPlaced',
      payload: { items, total: items.reduce((sum, i) => sum + i.price * i.qty, 0) },
      version: this.state.version + 1,
      timestamp: new Date(),
    });
  }

  pay() {
    if (this.state.status !== 'placed') {
      throw new Error('Order not placed');
    }
    this.apply({
      id: crypto.randomUUID(),
      aggregateId: this.id,
      aggregateType: 'order',
      type: 'OrderPaid',
      payload: { paidAt: new Date() },
      version: this.state.version + 1,
      timestamp: new Date(),
    });
  }

  private apply(event: DomainEvent) {
    this.events.push(event);
    this.state = this.reduce(this.state, event);
  }

  private reduce(state: OrderState, event: DomainEvent): OrderState {
    switch (event.type) {
      case 'OrderPlaced':
        return { ...state, status: 'placed', items: event.payload.items, total: event.payload.total, version: event.version };
      case 'OrderPaid':
        return { ...state, status: 'paid', paidAt: event.payload.paidAt, version: event.version };
      default:
        return state;
    }
  }

  get uncommittedEvents(): DomainEvent[] {
    return this.events;
  }
}
```

### 3. Projection（物化视图）

```ts
// order.projection.ts
class OrderProjection {
  async handle(event: DomainEvent) {
    switch (event.type) {
      case 'OrderPlaced':
        await db('order_read').insert({
          id: event.aggregateId,
          status: 'placed',
          items: JSON.stringify(event.payload.items),
          total: event.payload.total,
          created_at: event.timestamp,
        });
        break;
      case 'OrderPaid':
        await db('order_read')
          .where({ id: event.aggregateId })
          .update({ status: 'paid', paid_at: event.timestamp });
        break;
    }
  }
}
```

## 事件溯源 vs CRUD

| 维度 | Event Sourcing | CRUD |
| --- | --- | --- |
| 数据模型 | 事件序列 | 当前状态 |
| 可审计 | 天然完整历史 | 需额外日志 |
| 性能 | 写快、读需投影 | 读写均衡 |
| 复杂度 | 高 | 低 |
| 适用 | 金融、审计、复杂业务 | 常规 CRUD |

## 注意事项

- 事件 schema 演化：使用版本号 + upcaster 兼容旧事件。
- 快照：聚合事件过多时，定期保存快照加速重建。
- GDPR：删除个人信息需用 "删除事件" 覆盖，而非物理删除。
