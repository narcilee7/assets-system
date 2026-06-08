# Node.js API Error Model

一致、可观测、可恢复的错误模型是 API 可靠性的基石。

## 设计原则

1. **结构化**：错误必须包含 `code`、`message`、`details`，方便客户端做分支判断。
2. **可追踪**：每次请求携带 `traceId`，贯穿日志、响应头、下游调用。
3. **可恢复**：区分 `retryable`（客户端可重试）和 `fatal`（客户端不应重试）。
4. **不泄漏**：生产环境不返回堆栈，内部错误映射为通用错误码。

## 错误码规范

| Code | HTTP Status | 说明 |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | 参数校验失败 |
| `UNAUTHORIZED` | 401 | 未认证 |
| `FORBIDDEN` | 403 | 无权限 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 资源冲突 |
| `RATE_LIMITED` | 429 | 限流 |
| `INTERNAL_ERROR` | 500 | 内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用（可重试） |

## 核心实现

### 1. 应用错误基类

```ts
// app-error.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
    public readonly retryable: boolean = false
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export const Errors = {
  validation: (details?: Record<string, unknown>) =>
    new AppError('VALIDATION_ERROR', 'Request validation failed', 400, details),
  unauthorized: () =>
    new AppError('UNAUTHORIZED', 'Authentication required', 401),
  notFound: (resource: string) =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),
  conflict: (message: string) =>
    new AppError('CONFLICT', message, 409),
  rateLimited: () =>
    new AppError('RATE_LIMITED', 'Too many requests', 429, undefined, true),
  internal: () =>
    new AppError('INTERNAL_ERROR', 'Internal server error', 500),
  serviceUnavailable: () =>
    new AppError('SERVICE_UNAVAILABLE', 'Service temporarily unavailable', 503, undefined, true),
} as const;
```

### 2. Express / Koa / Fastify 全局错误中间件

```ts
// error-middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from './app-error';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const traceId = req.headers['x-trace-id'] || crypto.randomUUID();

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ...err.toJSON(),
      traceId,
    });
    return;
  }

  // 未知错误：生产环境不暴露堆栈
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    traceId,
    ...(isDev && { stack: err.stack }),
  });
}
```

### 3. 异步路由包装器

```ts
// async-handler.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler(fn: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

### 4. 使用示例

```ts
// routes.ts
import { Router } from 'express';
import { asyncHandler } from './async-handler';
import { Errors } from './app-error';

const router = Router();

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.user.findById(req.params.id);
  if (!user) throw Errors.notFound('User');
  res.json(user);
}));

router.post('/orders', asyncHandler(async (req, res) => {
  if (!req.body.productId) {
    throw Errors.validation({ productId: 'required' });
  }
  const order = await createOrder(req.body);
  res.status(201).json(order);
}));
```

## 最佳实践

- 所有 Service 层抛 `AppError`，Controller 层只做转换和响应。
- 使用 `asyncHandler` 或框架内置的异步错误捕获（如 Fastify 自动捕获）。
- 错误日志统一通过 `req.log.error({ err, traceId })` 输出结构化日志。
- 下游 HTTP 调用失败时，根据状态码映射为对应的 `AppError`，保留 `retryable` 语义。
