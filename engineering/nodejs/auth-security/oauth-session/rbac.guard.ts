import { Request, Response, NextFunction } from 'express';

export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = (req as any).user?.roles || [];
    const hasRole = allowedRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }
    next();
  };
}
