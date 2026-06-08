# CSRF 保护工程化

## 1. Token 机制（Synchronizer Token）

```javascript
// 服务端生成 Token
const crypto = require('crypto');

function generateCSRFToken(sessionId) {
  const secret = process.env.CSRF_SECRET;
  return crypto
    .createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64');
}

function verifyCSRFToken(token, sessionId) {
  const expected = generateCSRFToken(sessionId);
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expected)
  );
}

// Express 中间件
function csrfProtection(req, res, next) {
  // GET 请求不需要验证
  if (req.method === 'GET') {
    // 生成新 Token 并放入表单/cookie
    const token = generateCSRFToken(req.session.id);
    res.locals.csrfToken = token;
    res.cookie('csrf_token', token, { httpOnly: false, sameSite: 'strict' });
    return next();
  }

  // POST/PUT/DELETE 验证 Token
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  if (!token || !verifyCSRFToken(token, req.session.id)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

// 前端发送请求时携带 Token
fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': document.cookie.match(/csrf_token=([^;]+)/)?.[1],
  },
  body: JSON.stringify({ amount: 100 }),
});
```

## 2. SameSite Cookie

```javascript
// 最有效的 CSRF 防御（浏览器原生支持）
res.cookie('sessionId', sessionId, {
  httpOnly: true,       // 禁止 JS 访问
  secure: true,         // 仅 HTTPS
  sameSite: 'strict',   // 完全禁止跨站 Cookie 发送
  // sameSite: 'lax',   // 允许 top-level GET 导航（推荐默认值）
  maxAge: 86400000,
});

// SameSite 选项对比
// None:   所有请求都发送 Cookie（需配合 Secure）
// Lax:    同源请求 + 跨站 GET 导航（推荐）
// Strict: 仅同源请求（最安全，但影响用户体验）
```

## 3. Origin / Referer 验证

```javascript
function validateOrigin(req, res, next) {
  const allowedOrigins = ['https://example.com', 'https://app.example.com'];
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // 优先检查 Origin 头（POST/PUT/DELETE 必有）
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  // 回退检查 Referer
  if (!origin && referer) {
    const refererOrigin = new URL(referer).origin;
    if (!allowedOrigins.includes(refererOrigin)) {
      return res.status(403).json({ error: 'Invalid referer' });
    }
  }

  next();
}
```

## 4. 双重 Cookie 提交

```javascript
// 不需要服务端存储 Token 的方案
// 1. 设置 Cookie：csrf_token=random_value
// 2. 前端读取 Cookie 放入请求头
// 3. 服务端比较 Cookie 中的值和 Header 中的值

function doubleSubmitCookie(req, res, next) {
  if (req.method === 'GET') {
    const token = crypto.randomBytes(32).toString('base64');
    res.cookie('csrf_token', token, {
      httpOnly: false,  // 允许 JS 读取
      sameSite: 'strict',
      secure: true,
    });
    return next();
  }

  const cookieToken = req.cookies.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  next();
}
```

## 5. 防御策略选择

| 策略 | 安全性 | 复杂度 | 推荐场景 |
|------|--------|--------|---------|
| SameSite=Lax | 高 | 低 | **首选，所有场景** |
| SameSite=Strict | 最高 | 低 | 高安全要求 |
| Token 机制 | 高 | 中 | 需要额外安全层 |
| 双重 Cookie | 中 | 低 | 无状态应用 |
| Origin 验证 | 中 | 低 | API 网关层 |
