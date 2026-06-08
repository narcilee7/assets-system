# Express Middleware Architecture

Express 是 Node.js 最成熟的 Web 框架。理解其中间件模型是构建可扩展 HTTP 服务的基础。

## 中间件类型

| 类型 | 签名 | 用途 |
| --- | --- | --- |
| 应用级 | `app.use(fn)` | 全局处理（日志、鉴权） |
| 路由级 | `router.use(fn)` | 局部路由处理 |
| 错误处理 | `(err, req, res, next)` | 全局异常捕获 |
| 内置 | `express.json()` | 解析请求体 |
| 第三方 | `compression()` | 压缩响应 |

## 核心实现

### 1. 洋葱模型 vs Express 线性模型

Express 是线性模型（先注册先执行），Koa 才是洋葱模型（先注册先进入、后退出）。

```js
// linear-vs-onion.js
const express = require('express');
const app = express();

app.use((req, res, next) => {
  console.log('A: before');
  next();
  console.log('A: after'); // 在响应已发出后才执行，实际用处有限
});

app.use((req, res, next) => {
  console.log('B: before');
  res.send('done');
  // next() 可省略，但推荐显式结束响应
});

// 输出：A: before -> B: before -> A: after
```

### 2. 可组合的中间件工厂

```js
// middleware-factory.js
function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ code: 'FORBIDDEN', message: `Role ${role} required` });
    }
    next();
  };
}

function rateLimit({ windowMs, max }) {
  const requests = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    const history = (requests.get(key) || []).filter((t) => t > windowStart);
    if (history.length >= max) {
      return res.status(429).json({ code: 'RATE_LIMITED' });
    }
    history.push(now);
    requests.set(key, history);
    next();
  };
}

module.exports = { requireRole, rateLimit };
```

### 3. 安全头中间件

```js
// security-headers.js
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.removeHeader('X-Powered-By');
  next();
}

module.exports = { securityHeaders };
```

## 最佳实践

- 中间件执行顺序决定行为：日志 -> 安全头 -> 解析 -> 鉴权 -> 业务 -> 错误处理。
- 错误处理中间件必须是 4 参数签名 `(err, req, res, next)`。
- 异步中间件必须捕获异常并传给 `next(err)`，否则请求会挂起。
- 每个中间件只做一件事（单一职责）。
