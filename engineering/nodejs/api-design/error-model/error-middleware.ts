import { Request, Response, NextFunction } from 'express';
import { AppError } from './app-error';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ...err.toJSON(),
      traceId,
    });
    return;
  }

  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    traceId,
    ...(isDev && { stack: err.stack }),
  });
}
