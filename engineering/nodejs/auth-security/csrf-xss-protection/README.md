# CSRF & XSS Protection

Web 安全的基础防线，Node.js 服务端必须正确配置才能防御这两类攻击。

## CSRF（跨站请求伪造）

### 防御策略

| 策略 | 说明 | 适用 |
| --- | --- | --- |
| SameSite Cookie | `SameSite=Lax/Strict` | 现代浏览器 |
| CSRF Token | 服务端生成、校验 | 传统表单 |
| Double Submit Cookie | Cookie + Header 比对 | SPA |
| Custom Header | 如 `X-Requested-With` | API |

### 实现

```ts
// csrf-protection.ts
import { Request, Response, NextFunction } from 'express';
import csrf from 'csurf';

// 方案1: csurf 中间件（Session/Cookie 场景）
export const csrfProtection = csrf({ cookie: { httpOnly: true, sameSite: 'strict' } });

// 方案2: Double Submit Cookie（SPA/API 场景）
export function doubleSubmitCookie(req: Request, res: Response, next: NextFunction) {
  const csrfToken = req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];
  if (!csrfToken || csrfToken !== headerToken) {
    return res.status(403).json({ code: 'CSRF_VIOLATION' });
  }
  next();
}

// 生成 Token 端点
export function setCsrfToken(req: Request, res: Response) {
  const token = crypto.randomUUID();
  res.cookie('csrf-token', token, { httpOnly: true, sameSite: 'strict', secure: true });
  res.json({ csrfToken: token });
}
```

## XSS（跨站脚本攻击）

### 防御策略

| 类型 | 防御 |
| --- | --- |
| 存储型 XSS | 入库前转义 / 使用 DOMPurify |
| 反射型 XSS | CSP + 响应头 |
| DOM 型 XSS | 前端避免 innerHTML |

### 实现

```ts
// xss-protection.ts
import helmet from 'helmet';
import DOMPurify from 'isomorphic-dompurify';

// CSP 头
export const cspMiddleware = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'nonce-<random>'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
});

// 输入净化
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong'] });
}

// 响应头安全组合
export const securityHeaders = [
  helmet({
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  }),
  cspMiddleware,
];
```

## Checklist

- [ ] Cookie 设置 `HttpOnly; Secure; SameSite=Lax/Strict`。
- [ ] 所有用户输入在入库/输出前净化。
- [ ] CSP 限制 script-src、object-src。
- [ ] 关键操作（转账、删号）需二次验证（密码、短信）。
- [ ] 使用 `helmet` 一键配置安全头。
