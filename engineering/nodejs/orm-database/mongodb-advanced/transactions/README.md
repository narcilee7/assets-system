# MongoDB Multi-Document Transactions

MongoDB 4.0+ 支持多文档 ACID 事务（副本集），4.2+ 支持分片集群事务。

## 与关系型数据库事务的区别

| 维度 | MongoDB | PostgreSQL |
| --- | --- | --- |
| 默认隔离 | Snapshot | Read Committed |
| 超时 | 默认 60s | 由 `statement_timeout` 控制 |
| 锁粒度 | 文档级 | 行级/表级 |
| 性能影响 | 较大（oplog 压力） | 较小 |
| 推荐 | 尽量不用，必要时用 | 常规使用 |

## 核心实现

```ts
// mongo-transactions.ts
import mongoose from 'mongoose';
import { User } from '../mongoose-example/schemas/user.schema';
import { Order } from '../mongoose-example/schemas/order.schema';

export async function placeOrderWithTransaction(
  userId: string,
  productId: string,
  amount: number,
) {
  const session = await mongoose.startSession();
  session.startTransaction({
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  });

  try {
    // 1. 扣减余额
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: -amount } },
      { session, new: true }
    );

    if (!user || user.balance < 0) {
      throw new Error('Insufficient balance');
    }

    // 2. 创建订单
    const [order] = await Order.create(
      [{ userId, productId, amount, status: 'paid' }],
      { session }
    );

    // 3. 扣减库存（假设有 Inventory 集合）
    // await Inventory.findOneAndUpdate(
    //   { productId },
    //   { $inc: { stock: -1 } },
    //   { session }
    // );

    await session.commitTransaction();
    return order;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// 乐观锁（版本号）
export async function updateUserWithVersion(
  userId: string,
  updates: any,
  expectedVersion: number,
) {
  const result = await User.updateOne(
    { _id: userId, __v: expectedVersion },
    { ...updates, $inc: { __v: 1 } }
  );

  if (result.modifiedCount === 0) {
    throw new Error('Concurrent modification detected');
  }
}
```

## 事务最佳实践

- **尽量不用**：MongoDB 文档模型设计应以内嵌为主，避免需要事务的场景。
- **短小**：事务应在 100ms 内完成，长时间事务会阻塞 oplog。
- **避免大量文档**：一个事务修改的文档数不超过 1000。
- **错误处理**：始终 `try/finally` 确保 `endSession()` 被调用。
- **重试**：网络分区时事务可能失败，需应用层实现幂等重试。
