import { Request, Response, NextFunction } from 'express';

export function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  timeoutMs: number = 2000,
) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await Promise.race([
        primary(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Primary timeout')), timeoutMs)
        ),
      ]);
      (res as any).locals.data = result;
      next();
    } catch {
      const result = await fallback();
      (res as any).locals.data = result;
      next();
    }
  };
}
