# tRPC Router

tRPC 是端到端类型安全的 RPC 框架，前端调用后端如同调用本地函数，无需生成代码或维护 OpenAPI/GraphQL Schema。

## 核心实现

### 1. Router 定义

```ts
// server/router.ts
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  user: t.router({
    getById: t.procedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        return db.user.findById(input.id);
      }),

    update: t.procedure
      .input(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.userId) throw new Error('Unauthorized');
        return db.user.update(input.id, { name: input.name });
      }),
  }),

  order: t.router({
    list: t.procedure
      .input(z.object({ page: z.number().min(1).default(1), limit: z.number().min(1).max(100).default(20) }))
      .query(async ({ input, ctx }) => {
        return db.order.findByUser(ctx.userId, input.page, input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

### 2. HTTP Handler

```ts
// server/handler.ts
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { appRouter } from './router';

const handler = createHTTPHandler({
  router: appRouter,
  createContext: (opts) => {
    const token = opts.req.headers.authorization?.replace('Bearer ', '');
    return { userId: verifyToken(token) };
  },
});

import { createServer } from 'http';
createServer(handler).listen(3000);
```

### 3. 前端调用

```ts
// client.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router';

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:3000' })],
});

// 类型安全的调用
const user = await client.user.getById.query({ id: 'uuid-here' });
const updated = await client.user.update.mutate({ id: 'uuid-here', name: 'Alice' });
```

## tRPC vs GraphQL vs REST

| 维度 | tRPC | GraphQL | REST |
| --- | --- | --- | --- |
| 类型安全 | 端到端 TypeScript | 需生成代码 | 需 OpenAPI + 生成 |
| 学习成本 | 低（会 TS 即可） | 中 | 低 |
| 前端框架 | React Query 集成好 | Apollo / Relay | fetch / SWR |
| 跨语言 | ❌ 仅限 TS | ✅ | ✅ |
| 适用 | 全栈 TS 团队 | 多客户端、复杂查询 | 简单 CRUD |

> 全栈 TypeScript 团队首选 tRPC；需要多语言客户端或公开 API 选 GraphQL/REST。
