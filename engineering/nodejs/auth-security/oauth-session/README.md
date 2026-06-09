# OAuth + Session Architecture

现代 Node.js 服务的鉴权架构需要同时支持多种客户端（Web、App、第三方集成）。

## 架构选择

| 方案 | 适合 | 注意 |
| --- | --- | --- |
| Session + Cookie | 传统 Web | CSRF、SameSite、域名限制 |
| JWT Access + Refresh Token | SPA / App | 吊销困难、短有效期 |
| OAuth 2.0 + PKCE | 第三方登录、移动应用 | state、code_verifier |
| OIDC (OpenID Connect) | 企业 SSO | id_token、userinfo |

## 核心实现

### 1. Passport OAuth 2.0 Strategy

```ts
// oauth.strategy.ts
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import passport from 'passport';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      const user = await findOrCreateUser({
        provider: 'google',
        providerId: profile.id,
        email: profile.emails?.[0].value,
        name: profile.displayName,
      });
      done(null, user);
    }
  )
);
```

### 2. JWT + Refresh Token 服务

```ts
// token.service.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export class TokenService {
  generateAccessToken(userId: string, roles: string[]): string {
    return jwt.sign({ sub: userId, roles }, ACCESS_SECRET, { expiresIn: '15m' });
  }

  generateRefreshToken(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    // 存储到 Redis，TTL 7 天
    await redis.setex(`refresh:${token}`, 7 * 24 * 60 * 60, userId);
    return token;
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const userId = await redis.get(`refresh:${refreshToken}`);
    if (!userId) throw new Error('Invalid refresh token');
    return this.generateAccessToken(userId, await getRoles(userId));
  }

  async revokeRefreshToken(refreshToken: string) {
    await redis.del(`refresh:${refreshToken}`);
  }
}
```

### 3. 安全中间件组合

```ts
// security.middleware.ts
import helmet from 'helmet';
import csrf from 'csurf';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

export const securityMiddleware = [
  helmet(),
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
  }),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || 'unknown',
  }),
];
```

### 4. RBAC 守卫

```ts
// rbac.guard.ts
import { Request, Response, NextFunction } from 'express';

export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles || [];
    const hasRole = allowedRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }
    next();
  };
}
```

## 安全 Checklist

- [ ] 所有 Cookie 设置 `HttpOnly; Secure; SameSite=Lax/Strict`。
- [ ] JWT Secret 定期轮换，旧 Secret 保留短暂兼容期。
- [ ] Refresh Token 使用单向哈希存储，支持按用户吊销。
- [ ] OAuth callback 严格校验 `state` 参数，防止 CSRF。
- [ ] 密码使用 `bcrypt` / `argon2`，cost factor >= 12。
- [ ] 登录接口做速率限制，防止暴力破解。
