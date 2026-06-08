# API Gateway with Auth & Rate Limit

API Gateway 是后端架构的入口，负责路由、鉴权、限流、日志和协议转换。

## 核心职责

| 职责 | 实现方式 |
| --- | --- |
| 路由 | 基于 path / host 转发到不同上游 |
| 鉴权 | JWT 校验、OAuth introspection |
| 限流 | Token Bucket、固定窗口、滑动窗口 |
| 日志 | 统一请求日志、链路追踪 |
| 协议转换 | HTTP <> gRPC、REST <> GraphQL |
| 响应转换 | 聚合、过滤、错误统一化 |

## 轻量级 Node.js Gateway 实现

```ts
// gateway.ts
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { securityMiddleware } from '../../auth-security/oauth-session/security.middleware';
import { errorMiddleware } from '../../api-design/error-model/error-middleware';

const app = express();

// 安全层
app.use(securityMiddleware);

// 鉴权中间件
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ code: 'UNAUTHORIZED' });
  }
});

// 限流中间件
const rateLimiter = new Map<string, number[]>();
app.use((req, res, next) => {
  const key = (req as any).user?.sub || req.ip;
  const now = Date.now();
  const window = 60_000;
  const max = 100;
  const history = rateLimiter.get(key) || [];
  const recent = history.filter((t) => now - t < window);
  if (recent.length >= max) {
    return res.status(429).json({ code: 'RATE_LIMITED' });
  }
  recent.push(now);
  rateLimiter.set(key, recent);
  next();
});

// 路由转发
app.use('/users', createProxyMiddleware({ target: process.env.USER_SERVICE_URL, changeOrigin: true }));
app.use('/orders', createProxyMiddleware({ target: process.env.ORDER_SERVICE_URL, changeOrigin: true }));

// 错误处理
app.use(errorMiddleware);

app.listen(8080, () => console.log('Gateway on :8080'));
```

## 生产建议

- 高流量场景使用 Nginx / Envoy / Kong 作为边缘网关，Node.js 做业务网关。
- 限流状态存入 Redis，支持多实例共享配额。
- 使用 `http-proxy-middleware` 的 `onProxyRes` 统一修改响应头。
- 开启 `follow-redirects: false`，防止开放代理漏洞。
