# JWT Complete Implementation

JWT 是无状态鉴权的标准方案，但需要正确实现才能避免安全漏洞。

## 核心实现

### 1. JWT Service

```ts
// jwt.service.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface TokenPayload {
  sub: string;
  roles: string[];
  jti: string;
  type: 'access' | 'refresh';
}

export class JWTService {
  private accessSecret: Buffer;
  private refreshSecret: Buffer;

  constructor() {
    this.accessSecret = Buffer.from(process.env.JWT_ACCESS_SECRET!, 'base64');
    this.refreshSecret = Buffer.from(process.env.JWT_REFRESH_SECRET!, 'base64');
  }

  generateAccessToken(userId: string, roles: string[]): string {
    return jwt.sign(
      { sub: userId, roles, jti: crypto.randomUUID(), type: 'access' },
      this.accessSecret,
      { expiresIn: '15m', algorithm: 'HS256' }
    );
  }

  generateRefreshToken(userId: string): { token: string; jti: string } {
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { sub: userId, jti, type: 'refresh' },
      this.refreshSecret,
      { expiresIn: '7d', algorithm: 'HS256' }
    );
    return { token, jti };
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.accessSecret, { algorithms: ['HS256'] }) as TokenPayload;
  }

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, this.refreshSecret, { algorithms: ['HS256'] }) as TokenPayload;
  }

  decode(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}
```

### 2. Refresh Token Store（Redis）

```ts
// refresh-store.ts
import { Redis } from 'ioredis';

const redis = new Redis();

export class RefreshTokenStore {
  async save(jti: string, userId: string, ttlSeconds = 7 * 24 * 60 * 60): Promise<void> {
    await redis.setex(`refresh:${jti}`, ttlSeconds, userId);
    await redis.sadd(`user-refresh:${userId}`, jti);
  }

  async validate(jti: string, userId: string): Promise<boolean> {
    const stored = await redis.get(`refresh:${jti}`);
    return stored === userId;
  }

  async revoke(jti: string): Promise<void> {
    await redis.del(`refresh:${jti}`);
  }

  async revokeAll(userId: string): Promise<void> {
    const jtis = await redis.smembers(`user-refresh:${userId}`);
    const pipeline = redis.pipeline();
    for (const jti of jtis) {
      pipeline.del(`refresh:${jti}`);
    }
    pipeline.del(`user-refresh:${userId}`);
    await pipeline.exec();
  }
}
```

### 3. Express 认证中间件

```ts
// auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { JWTService } from './jwt.service';

const jwtService = new JWTService();

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing token' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwtService.verifyAccessToken(token);
    (req as any).user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Token expired' });
    }
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid token' });
  }
}
```

## JWT 安全要点

- **算法混淆攻击**：显式指定 `algorithms: ['HS256']`，防止攻击者将算法改为 `none`。
- **密钥强度**：Access Secret 和 Refresh Secret 必须不同，且 >= 256 bit。
- **Token 存储**：Access Token 存内存（如 React Context），Refresh Token 存 `HttpOnly` Cookie。
- **吊销**：Access Token 短有效期（15m）+ Refresh Token Redis 存储实现吊销。
