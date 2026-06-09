# Koa Onion Model

Koa 是 Express 原班人马打造的下一代框架，核心创新是洋葱模型（Onion Model）和 async/await 原生支持。

## 洋葱模型图解

```
       request
          |
    +-----v-----+
    |  middleware1  <-- 进入
    |   +-----v-----+
    |   |  middleware2  <-- 进入
    |   |   +-----v-----+
    |   |   |  middleware3  <-- 进入
    |   |   |   +-----v-----+
    |   |   |   |   handler   <-- 业务逻辑
    |   |   |   +-----^-----+
    |   |   |  middleware3  <-- 离开
    |   |   +-----^-----+
    |   |  middleware2  <-- 离开
    |   +-----^-----+
    |  middleware1  <-- 离开
    +-----^-----+
          |
       response
```

## 核心实现

### 1. 洋葱中间件示例

```ts
// app.ts
import Koa from 'koa';
import Router from '@koa/router';

const app = new Koa();
const router = new Router();

// 日志中间件（进入+离开）
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`--> ${ctx.method} ${ctx.url}`);
  await next(); // 等待内层完成
  console.log(`<-- ${ctx.method} ${ctx.url} ${ctx.status} ${Date.now() - start}ms`);
});

// 错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    ctx.status = err.status || 500;
    ctx.body = { code: err.code || 'INTERNAL_ERROR', message: err.message };
    ctx.app.emit('error', err, ctx);
  }
});

// 路由
router.get('/users/:id', async (ctx) => {
  ctx.body = { id: ctx.params.id, name: 'Alice' };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(3000);
```

### 2. 组合式中间件

```ts
// compose.ts
import compose from 'koa-compose';

const middleware1 = async (ctx: any, next: any) => {
  ctx.state.user = { id: '1', role: 'admin' };
  await next();
};

const middleware2 = async (ctx: any, next: any) => {
  if (ctx.state.user.role !== 'admin') {
    ctx.throw(403, 'Admin only');
  }
  await next();
};

const composed = compose([middleware1, middleware2]);
app.use(composed);
```

## Koa vs Express

| 维度 | Koa | Express |
| --- | --- | --- |
| 中间件模型 | 洋葱（可包裹响应） | 线性（只能前置） |
| 异步 | 原生 async/await | 回调 + 第三方 asyncHandler |
| 体积 | ~2KB | ~50KB |
| 生态 | 小而精 | 大而全 |
| 学习曲线 | 需理解洋葱模型 | 直观 |

> 推荐：喜欢极简和完全控制选 Koa；需要快速开发和生态选 Express/NestJS。
