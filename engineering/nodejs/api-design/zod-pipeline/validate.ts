import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { Errors } from '../error-model/app-error';

export function validate<T>(schema: ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = flattenZodError(result.error);
      next(Errors.validation(details));
      return;
    }
    req[source] = result.data as any;
    next();
  };
}

function flattenZodError(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    details[path] = details[path] || [];
    details[path].push(issue.message);
  }
  return details;
}
