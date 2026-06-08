# Integration Testing with Supertest

集成测试验证多个层（路由 -> 中间件 -> 服务 -> 数据库）的协作，比单元测试更接近真实行为。

## 示例

```ts
// app.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();

describe('POST /orders', () => {
  beforeAll(async () => {
    await prisma.order.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create an order and return 201', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ productId: 'p1', quantity: 2 })
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.productId).toBe('p1');
  });

  it('should return 400 for invalid input', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ productId: 'p1' }) // missing quantity
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
```

## 数据库隔离

```ts
// test-setup.ts
import { execSync } from 'child_process';
import { prisma } from '../src/prisma';

export async function setupTestDb() {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/test_db';
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
}

export async function resetDb() {
  const tables = ['Order', 'User'];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
}
```

## Testcontainers（可选）

```ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const container = await new PostgreSqlContainer().start();
process.env.DATABASE_URL = container.getConnectionUri();
```

> Testcontainers 启动慢但完全隔离，适合 CI；本地开发可用固定 test DB。
