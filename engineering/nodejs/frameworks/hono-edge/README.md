# Hono Edge Runtime

Hono 是一个超轻量、超快速的 Web 框架，专为 Edge Runtime（Cloudflare Workers、Deno Deploy、Vercel Edge）设计。

## 特点

- 零依赖，~15KB
- 支持 Web Standard API（Request / Response）
- 同一套代码跑在 Node.js、Deno、Bun、Cloudflare Workers
- 内置 middleware、validator、SSG

## 核心实现

### 1. Cloudflare Workers 版本

```ts
// src/index.ts
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { bearerAuth } from 'hono/bearer-auth';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono<{ Bindings: { JWT_SECRET: string } }>();

app.use(logger());

app.use('/api/*', async (c, next) => {
  const auth = bearerAuth({ token: c.env.JWT_SECRET });
  return auth(c, next);
});

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

app.post('/api/users', zValidator('json', schema), async (c) => {
  const data = c.req.valid('json');
  // 使用 Cloudflare D1 / KV / Durable Objects
  await c.env.DB.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
    .bind(data.name, data.email)
    .run();
  return c.json({ id: crypto.randomUUID(), ...data }, 201);
});

app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first();
  if (!user) return c.json({ code: 'NOT_FOUND' }, 404);
  return c.json(user);
});

export default app;
```

### 2. Node.js 适配

```ts
// node-adapter.ts
import { serve } from '@hono/node-server';
import app from './src/index';

serve({
  fetch: app.fetch,
  port: 3000,
});
```

## 适用场景

- 全球低延迟 API（Cloudflare Workers 250+ 节点）
- 轻量级 BFF / 网关
- 需要跨运行时复用的库

> 限制：无 Node.js API（fs、net、child_process），数据库需通过 HTTP / WebSocket / 绑定访问。
