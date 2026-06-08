# Drizzle ORM Query Builder

Drizzle 是 SQL-like、类型安全的轻量 ORM，哲学是 "If you know SQL, you know Drizzle"。

## 核心实现

### 1. Schema 定义

```ts
// schema.ts
import { pgTable, uuid, varchar, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('order_status', ['PENDING', 'PAID', 'CANCELLED']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  balance: decimal('balance', { precision: 19, scale: 4 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: orderStatusEnum('status').default('PENDING'),
  amount: decimal('amount', { precision: 19, scale: 4 }).notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 2. 查询与关系

```ts
// db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

```ts
// queries.ts
import { eq, and, gte } from 'drizzle-orm';
import { db } from './db';
import { users, orders } from './schema';

// 单表查询
export async function getUserByEmail(email: string) {
  return db.select().from(users).where(eq(users.email, email)).limit(1);
}

// 关联查询
export async function getUserWithOrders(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      orders: true,
    },
  });
}

// 聚合
export async function getTotalSpent(userId: string) {
  const result = await db
    .select({ total: sql<number>`sum(${orders.amount})` })
    .from(orders)
    .where(eq(orders.userId, userId));
  return result[0]?.total || 0;
}
```

### 3. 事务

```ts
// transaction.ts
import { db } from './db';
import { users, orders } from './schema';
import { eq } from 'drizzle-orm';

export async function placeOrder(userId: string, amount: number) {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user) throw new Error('User not found');

    const newBalance = Number(user.balance) - amount;
    if (newBalance < 0) throw new Error('Insufficient balance');

    await tx.update(users).set({ balance: String(newBalance) }).where(eq(users.id, userId));
    const [order] = await tx.insert(orders).values({ userId, amount: String(amount), status: 'PAID' }).returning();

    return order;
  });
}
```

## Drizzle vs Prisma

| 维度 | Drizzle | Prisma |
| --- | --- | --- |
| 查询风格 | SQL-like | 声明式 |
| 包体积 | 极小 | 中等 |
| 迁移 | drizzle-kit | prisma migrate |
| 类型安全 | 优秀 | 优秀 |
| 生态 | 快速增长 | 成熟 |

> 喜欢 SQL 控制力的团队选 Drizzle；偏好声明式和强大迁移的团队选 Prisma。
