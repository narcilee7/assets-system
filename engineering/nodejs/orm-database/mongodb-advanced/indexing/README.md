# MongoDB Indexing Strategy

索引是 MongoDB 性能的核心。没有正确的索引，查询会退化为全表扫描（COLLSCAN）。

## 索引类型

| 类型 | 场景 | 示例 |
| --- | --- | --- |
| 单字段 | 单一条件查询 | `{ email: 1 }` |
| 复合 | 多条件联合查询 | `{ userId: 1, status: -1 }` |
| 多键 | 数组字段 | `{ tags: 1 }` |
| 文本 | 全文搜索 | `{ title: 'text', body: 'text' }` |
| TTL | 自动过期 | `{ createdAt: 1 }, { expireAfterSeconds: 3600 }` |
| 唯一 | 去重 | `{ email: 1 }, { unique: true }` |
| 部分 | 只索引符合条件的文档 | `{ status: 1 }, { partialFilterExpression: { status: 'active' } }` |
| 稀疏 | 跳过无该字段的文档 | `{ mobile: 1 }, { sparse: true }` |

## ESR 规则（Equality → Sort → Range）

复合索引字段顺序遵循 ESR 规则：等值条件在前，排序其次，范围条件最后。

```ts
// 查询：db.orders.find({ userId: 'xxx', status: 'paid' }).sort({ createdAt: -1 }).limit(10)
// 正确索引
Order.collection.createIndex({ userId: 1, status: 1, createdAt: -1 });

// 错误：范围条件 status 在排序 createdAt 之前
// Order.collection.createIndex({ userId: 1, createdAt: -1, status: 1 }); // ❌
```

## 核心实现

```ts
// indexing-strategy.ts
import { Order } from '../mongoose-example/schemas/order.schema';

export async function setupIndexes() {
  // 1. 核心业务查询：用户订单列表
  await Order.collection.createIndex(
    { userId: 1, status: 1, createdAt: -1 },
    { name: 'idx_user_status_created' }
  );

  // 2. 时间范围查询（订单报表）
  await Order.collection.createIndex(
    { status: 1, createdAt: -1 },
    { partialFilterExpression: { status: 'paid' } } // 只索引已支付
  );

  // 3. 全文搜索
  await Order.collection.createIndex(
    { note: 'text' },
    { default_language: 'none' }
  );

  // 4. TTL 索引（临时数据自动清理）
  await Order.collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
  );
}

// 索引监控
export async function analyzeQueries() {
  const slowQueries = await Order.collection.database.admin().command({
    profile: 1,
    slowms: 100,
  });
  return slowQueries;
}
```

## 索引管理 Checklist

- [ ] 生产环境索引通过 migrations 管理，不在 `ensureIndex` 中自动创建。
- [ ] 定期运行 `db.collection.aggregate([{ $indexStats: {} }])` 查看索引使用频率。
- [ ] 删除未使用的索引（监控 `accesses.ops`）。
- [ ] 大型集合加索引使用 `background: true`，避免阻塞写入。
- [ ] 索引键总大小不超过 1024 bytes。
