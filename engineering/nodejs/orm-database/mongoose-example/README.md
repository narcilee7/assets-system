# Mongoose ODM Pattern

Mongoose 是 MongoDB 的官方 ODM，提供 Schema 定义、中间件、验证和查询构建器。

## 核心实现

### 1. Schema 定义

```ts
// schemas/user.schema.ts
import { Schema, model, Types } from 'mongoose';

export interface IUser {
  email: string;
  name: string;
  balance: number;
  orders: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    balance: { type: Number, default: 0 },
    orders: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
  },
  { timestamps: true }
);

userSchema.index({ email: 1, createdAt: -1 });

export const User = model<IUser>('User', userSchema);
```

```ts
// schemas/order.schema.ts
import { Schema, model } from 'mongoose';

export interface IOrder {
  status: 'pending' | 'paid' | 'cancelled';
  amount: number;
  userId: Schema.Types.ObjectId;
  createdAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
    amount: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

export const Order = model<IOrder>('Order', orderSchema);
```

### 2. Repository 模式

```ts
// repositories/user.repository.ts
import { User, IUser } from '../schemas/user.schema';

export class UserRepository {
  async create(data: Partial<IUser>): Promise<IUser> {
    return User.create(data);
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id).populate('orders').lean().exec();
  }

  async decrementBalance(userId: string, amount: number, session?: any): Promise<void> {
    await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: -amount } },
      { session, new: true }
    );
  }
}
```

### 3. 事务（MongoDB 4.0+ Replica Set）

```ts
// services/order.service.ts
import mongoose from 'mongoose';
import { User } from '../schemas/user.schema';
import { Order } from '../schemas/order.schema';

export async function placeOrder(userId: string, amount: number) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error('User not found');
    if (user.balance < amount) throw new Error('Insufficient balance');

    await User.findByIdAndUpdate(userId, { $inc: { balance: -amount } }).session(session);
    const order = await Order.create([{ userId, amount, status: 'paid' }], { session });

    await session.commitTransaction();
    return order[0];
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
```

## 最佳实践

- 永远使用 `.lean()` 读取只读数据，减少 Mongoose Document 开销。
- 复杂聚合用 MongoDB Aggregation Pipeline，不要多次查询。
- 生产环境必须配置 `maxPoolSize` 和 `serverSelectionTimeoutMS`。
- 使用 `mongoose-paginate-v2` 处理分页。
