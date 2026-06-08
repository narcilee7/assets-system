# Fastify Performance Service

Fastify 是 Node.js 生态中性能最高的 Web 框架之一，基于 schema-first 设计和高效的 JSON 序列化。

## 核心优势

| 指标 | Fastify | Express |
| --- | --- | --- |
| 吞吐量 (req/s) | ~50K | ~15K |
| 启动时间 | 快 | 中 |
| Schema 校验 | 内置 | 需中间件 |
| 插件模型 | 封装作用域 | 全局 |
| JSON 序列化 | fast-json-stringify | JSON.stringify |

## 核心实现

### 1. 基础服务

```ts
// app.ts
import Fastify from 'fastify';
import { userRoutes } from './routes/user.routes';

const app = Fastify({
  logger: { level: 'info' },
  genReqId: () => crypto.randomUUID(),
});

app.register(userRoutes, { prefix: '/users' });

app.setErrorHandler((err, _req, reply) => {
  app.log.error(err);
  reply.status(err.statusCode || 500).send({
    code: err.code || 'INTERNAL_ERROR',
    message: err.message,
  });
});

export { app };
```

### 2. Schema-First 路由

```ts
// routes/user.routes.ts
import { FastifyInstance } from 'fastify';

const createUserSchema = {
  body: {
    type: 'object',
    required: ['email', 'name'],
    properties: {
      email: { type: 'string', format: 'email' },
      name: { type: 'string', minLength: 1 },
      age: { type: 'integer', minimum: 0 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
      },
    },
  },
};

export async function userRoutes(app: FastifyInstance) {
  app.post('/', { schema: createUserSchema }, async (req, reply) => {
    const user = await createUser(req.body as any);
    reply.status(201).send(user);
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await findUserById(id);
    if (!user) {
      reply.status(404).send({ code: 'NOT_FOUND', message: `User ${id} not found` });
      return;
    }
    reply.send(user);
  });
}
```

### 3. 装饰器模式插件

```ts
// plugins/auth.plugin.ts
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

export default fp(async (app) => {
  app.decorate('authenticate', async (req: any, reply: any) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      req.user = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      reply.status(401).send({ code: 'UNAUTHORIZED' });
    }
  });
});
```

## 生产要点

- 使用 `fastify-plugin` 打破封装，让插件注册的路由和装饰器在父作用域可见。
- JSON schema 不仅用于校验，还用于生成 `fast-json-stringify`，序列化速度提升 2-10x。
- 错误处理使用 `setErrorHandler`，区分 4xx 和 5xx 日志级别。
