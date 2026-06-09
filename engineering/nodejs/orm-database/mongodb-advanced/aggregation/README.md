# MongoDB Aggregation Pipeline

Aggregation Pipeline 是 MongoDB 的核心分析工具，类似于 Unix 管道，将数据通过多个阶段（stage）逐步转换。

## 核心阶段

| 阶段 | 说明 | SQL 类比 |
| --- | --- | --- |
| `$match` | 过滤文档 | WHERE |
| `$group` | 分组聚合 | GROUP BY |
| `$sort` | 排序 | ORDER BY |
| `$project` | 选择/重塑字段 | SELECT |
| `$lookup` | 左外连接 | LEFT JOIN |
| `$unwind` | 展开数组 | UNNEST |
| `$facet` | 多面聚合 | 多查询并行 |

## 核心实现

```ts
// aggregation-examples.ts
import { Order } from '../mongoose-example/schemas/order.schema';

// 1. 按状态统计订单数量和总金额
export async function ordersByStatus() {
  return Order.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);
}

// 2. Lookup 关联用户信息
export async function ordersWithUsers() {
  return Order.aggregate([
    { $match: { status: 'paid' } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        orderId: '$_id',
        amount: 1,
        'user.email': 1,
        'user.name': 1,
      },
    },
  ]);
}

// 3. 时间序列分析（按天聚合）
export async function dailyRevenue() {
  return Order.aggregate([
    { $match: { status: 'paid' } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        revenue: { $sum: '$amount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
  ]);
}

// 4. Facet 多面聚合（分页 + 统计同时返回）
export async function paginatedOrdersWithStats(page: number, limit: number) {
  return Order.aggregate([
    { $match: { status: 'paid' } },
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        metadata: [
          { $count: 'total' },
          {
            $addFields: {
              page,
              totalPages: { $ceil: { $divide: ['$total', limit] } },
            },
          },
        ],
      },
    },
  ]);
}
```

## 性能优化

- 在 `$match` 阶段使用索引字段，尽早过滤数据。
- `$sort` 在内存限制（100MB）外会报错，需加 `allowDiskUse: true` 或预排序索引。
- `$lookup` 性能较低，大数据量考虑反范式设计。
- 使用 `explain('executionStats')` 分析每个阶段的执行时间。
