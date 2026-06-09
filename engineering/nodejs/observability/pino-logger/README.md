# Pino Request Logger

结构化、高性能的日志是 Node.js 可观测性的起点。Pino 比 winston、bunyan 更快、更轻量。

## 核心设计

- **结构化 JSON**：每条日志都是 JSON，方便 ELK/Loki/Grafana 解析。
- **日志级别**：`trace` < `debug` < `info` < `warn` < `error` < `fatal`。
- **Context**：每个请求绑定 `traceId` 和 `reqId`，链路追踪的基础。
- **Redaction**：自动脱敏敏感字段（password、token）。

## 实现

### 1. Logger 工厂

```ts
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  redact: {
    paths: ['password', '*.password', 'token', 'authorization', 'cookie'],
    remove: true,
  },
  base: {
    service: process.env.SERVICE_NAME || 'nodejs-api',
    version: process.env.SERVICE_VERSION || 'unknown',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function getRequestLogger(reqId: string, traceId?: string) {
  return logger.child({ reqId, traceId });
}
```

### 2. Express 请求日志中间件

```ts
// request-logger.ts
import { Request, Response, NextFunction } from 'express';
import { getRequestLogger } from './logger';
import { randomUUID } from 'crypto';

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const reqId = (req.headers['x-request-id'] as string) || randomUUID();
  const traceId = (req.headers['x-trace-id'] as string) || reqId;

  req.log = getRequestLogger(reqId, traceId);
  res.setHeader('x-request-id', reqId);
  res.setHeader('x-trace-id', traceId);

  const start = Date.now();
  req.log.info({ req: { method: req.method, url: req.url } }, 'request start');

  res.on('finish', () => {
    const duration = Date.now() - start;
    req.log.info(
      {
        res: {
          statusCode: res.statusCode,
          durationMs: duration,
        },
      },
      'request completed'
    );
  });

  next();
}

declare global {
  namespace Express {
    interface Request {
      log: ReturnType<typeof getRequestLogger>;
    }
  }
}
```

### 3. 错误日志

```ts
// error-logger.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../api-design/error-model/app-error';

export function errorLoggerMiddleware(
  err: Error,
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (err instanceof AppError && err.statusCode < 500) {
    req.log.warn({ err: err.toJSON(), traceId: req.log.bindings()?.traceId }, 'client error');
  } else {
    req.log.error({ err: { message: err.message, stack: err.stack }, traceId: req.log.bindings()?.traceId }, 'server error');
  }
  next(err);
}
```

## 日志示例

```json
{"level":30,"time":"2024-01-15T08:30:00.123Z","service":"nodejs-api","reqId":"abc-123","traceId":"trace-456","req":{"method":"POST","url":"/orders"},"msg":"request start"}
{"level":30,"time":"2024-01-15T08:30:00.145Z","service":"nodejs-api","reqId":"abc-123","traceId":"trace-456","res":{"statusCode":201,"durationMs":22},"msg":"request completed"}
```

## 集成建议

- 开发环境用 `pino-pretty`，生产环境保持原始 JSON。
- 与 OpenTelemetry 集成时，将 `traceId` / `spanId` 注入日志字段。
- 采样：高 QPS 服务可对 `info` 级别日志做按比例采样，保留全部 `error` 日志。
