# Auth / Security

现代 Node.js 服务的鉴权架构需要同时支持多种客户端（Web、App、第三方集成）。

## 架构选择

| 方案 | 适合 | 注意 |
| --- | --- | --- |
| Session + Cookie | 传统 Web | CSRF、SameSite、域名限制 |
| JWT Access + Refresh Token | SPA / App | 吊销困难、短有效期 |
| OAuth 2.0 + PKCE | 第三方登录、移动应用 | state、code_verifier |
| OIDC | 企业 SSO | id_token、userinfo |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| JWT complete implementation | `jwt-implementation/` | JWT Service、Refresh Token Redis Store、Express Auth 中间件 |
| Password hashing (bcrypt/argon2) | `password-hashing/` | 算法对比、bcrypt、argon2、密码策略 |
| CSRF & XSS protection | `csrf-xss-protection/` | SameSite、Double Submit Cookie、CSP、DOMPurify |
| RBAC 守卫 | `oauth-session/rbac.guard.ts` | 角色权限校验 |
| Security middleware | `oauth-session/security.middleware.ts` | Helmet、CORS、Rate Limit |
