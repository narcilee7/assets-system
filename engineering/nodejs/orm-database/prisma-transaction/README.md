# Prisma Transaction & Migration

Prisma 是现代 Node.js 的类型安全 ORM。本资产覆盖事务边界、迁移策略和常见陷阱。

## 核心能力

| 能力 | API | 说明 |
| --- | --- | --- |
| 查询 | `prisma.model.findMany` | 类型安全、自动补全 |
| 嵌套写入 | `create({ data: { posts: { create: [] } } })` | 一次请求完成关联写入 |
| 事务 | `$transaction([...])` | 交互式或批量事务 |
| 交互式事务 | `$transaction(async (tx) => {...})` | 需要读取后写入的场景 |
| 迁移 | `prisma migrate dev` | 版本化 schema 变更 |

## 核心代码

### 1. Prisma Client 单例

```ts
// prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 2. Schema 设计

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  balance   Decimal  @default(0) @db.Decimal(19, 4)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  orders    Order[]
}

model Order {
  id        String      @id @default(uuid())
  status    OrderStatus @default(PENDING)
  amount    Decimal     @db.Decimal(19, 4)
  userId    String
  user      User        @relation(fields: [userId], references: [id])
  createdAt DateTime    @default(now())
}

enum OrderStatus {
  PENDING
  PAID
  CANCELLED
}
```

### 3. 交互式事务（扣减余额 + 创建订单）

```ts
// order.service.ts
import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

export async function placeOrder(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const newBalance = user.balance.toNumber() - amount;
    if (newBalance < 0) throw new Error('Insufficient balance');

    const [updatedUser, order] = await Promise.all([
      tx.user.update({
        where: { id: userId },
        data: { balance: newBalance },
      }),
      tx.order.create({
        data: { userId, amount, status: 'PAID' },
      }),
    ]);

    return { user: updatedUser, order };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000,
    timeout: 10000,
  });
}
```

### 4. 批量事务

```ts
// batch-tx.ts
import { prisma } from './prisma';

export async function batchUpdateStatuses(orderIds: string[]) {
  const updates = orderIds.map((id) =>
    prisma.order.update({ where: { id }, data: { status: 'PAID' } })
  );
  return prisma.$transaction(updates);
}
```

## 迁移工作流

```bash
# 修改 schema.prisma 后
npx prisma migrate dev --name add_order_status

# 生产环境（只应用、不生成）
npx prisma migrate deploy

# 生成客户端类型
npx prisma generate
```

## 生产 checklist

- [ ] 连接池：Prisma 默认按 `connection_limit = num_cpus * 2 + 1` 计算，Serverless 需调低。
- [ ] 交互式事务超时：`timeout` 必须小于数据库 `statement_timeout`。
- [ ] N+1：使用 `include` / `select` 预加载，或用 `findMany` + 手动 join。
- [ ] 软删除：用 `middleware` 拦截查询自动附加 `deletedAt: null` 条件。
- [ ] Decimal：金额永远用 `Decimal`，不用 `Float`。
