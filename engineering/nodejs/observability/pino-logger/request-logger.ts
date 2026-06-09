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
