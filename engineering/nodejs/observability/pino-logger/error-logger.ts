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
