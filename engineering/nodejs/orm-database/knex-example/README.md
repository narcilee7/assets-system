# Knex Query Builder

Knex 是 Node.js 最成熟的 SQL 查询构建器，不提供 ORM 的实体层，但给予你对 SQL 的完全控制力。

## 核心实现

### 1. 连接配置

```ts
// knexfile.ts
import type { Knex } from 'knex';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    migrations: { directory: './migrations' },
    seeds: { directory: './seeds' },
  },
  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: { directory: './migrations' },
  },
};

export default config;
```

```ts
// db.ts
import knex from 'knex';
import config from './knexfile';

export const db = knex(config[process.env.NODE_ENV || 'development']);
```

### 2. 查询构建

```ts
// queries.ts
import { db } from './db';

// 基础 CRUD
export async function getUserById(id: string) {
  return db('users').where({ id }).first();
}

export async function createUser(data: { email: string; name: string }) {
  const [user] = await db('users').insert(data).returning('*');
  return user;
}

// 关联查询
export async function getUserWithOrders(userId: string) {
  const user = await db('users').where({ id: userId }).first();
  const orders = await db('orders').where({ userId });
  return { ...user, orders };
}

// 聚合
export async function getUserTotalSpent(userId: string) {
  const result = await db('orders')
    .where({ userId, status: 'PAID' })
    .sum('amount as total')
    .first();
  return result?.total || 0;
}

// 复杂条件
export async function searchOrders(filters: { status?: string; minAmount?: number }) {
  let query = db('orders').select('*');
  if (filters.status) query = query.where({ status: filters.status });
  if (filters.minAmount) query = query.where('amount', '>=', filters.minAmount);
  return query.orderBy('created_at', 'desc');
}
```

### 3. 事务

```ts
// transaction.ts
import { db } from './db';

export async function placeOrder(userId: string, amount: number) {
  return db.transaction(async (trx) => {
    const user = await trx('users').where({ id: userId }).forUpdate().first();
    if (!user) throw new Error('User not found');

    const newBalance = Number(user.balance) - amount;
    if (newBalance < 0) throw new Error('Insufficient balance');

    await trx('users').where({ id: userId }).update({ balance: newBalance });
    const [order] = await trx('orders')
      .insert({ userId, amount, status: 'PAID' })
      .returning('*');

    return order;
  });
}
```

### 4. 迁移

```bash
npx knex migrate:make create_users
npx knex migrate:latest
npx knex migrate:rollback
```

```ts
// migrations/20240101000001_create_users.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').notNullable().unique();
    table.string('name').notNullable();
    table.decimal('balance', 19, 4).defaultTo(0);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('users');
}
```

## Knex vs ORM

| 维度 | Knex | Prisma / TypeORM |
| --- | --- | --- |
| SQL 控制 | 完全 | 有限 |
| 类型安全 | 需配合 TS 定义 | 原生 |
| 学习成本 | 低（会 SQL 即可） | 中 |
| 迁移 | 手动编写 | 自动生成/半自动 |
| 适用 | 复杂查询、报表 | 标准 CRUD |

> 复杂报表、动态查询、需要优化 SQL 执行计划的场景选 Knex；标准业务逻辑选 ORM。
