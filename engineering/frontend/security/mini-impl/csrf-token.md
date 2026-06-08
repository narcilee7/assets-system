# 手写 CSRF Token

## 1. Token 生成

```javascript
// mini-csrf.js

const crypto = require('crypto');

// 生成随机 Token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 存储（内存 / Redis / Session）
const tokenStore = new Map();  // userId -> token

function createCsrfToken(userId) {
  const token = generateToken();
  tokenStore.set(userId, token);
  return token;
}

function validateCsrfToken(userId, token) {
  const stored = tokenStore.get(userId);
  if (!stored) return false;

  // 使用 timing-safe 比较防止时序攻击
  const isValid = crypto.timingSafeEqual(
    Buffer.from(stored, 'hex'),
    Buffer.from(token, 'hex')
  );

  // 验证成功后重新生成（一次性 Token）
  if (isValid) {
    tokenStore.delete(userId);
  }

  return isValid;
}

// ============ Express 中间件 ============

function csrfProtection(req, res, next) {
  // GET / HEAD / OPTIONS 不需要防护
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const userId = req.session?.userId;

  if (!userId || !token || !validateCsrfToken(userId, token)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

// 获取 Token 的接口
app.get('/csrf-token', (req, res) => {
  const token = createCsrfToken(req.session.userId);
  res.json({ token });
});

// 保护的路由
app.post('/transfer', csrfProtection, (req, res) => {
  // 处理转账
});
```

## 2. 双重提交 Cookie 模式

```javascript
// 不需要服务端存储 Token

function doubleSubmitCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  // 比较 Cookie 和 Header 中的 Token
  if (!crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  )) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }

  next();
}

// 初始化：设置 Cookie Token
app.use((req, res, next) => {
  if (!req.cookies['csrf-token']) {
    const token = generateToken();
    res.cookie('csrf-token', token, {
      httpOnly: false,   // 前端需要读取
      secure: true,
      sameSite: 'strict',
    });
  }
  next();
});

// 前端自动携带
fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': getCookie('csrf-token'),  // 从 Cookie 读取
  },
  body: JSON.stringify(data),
});
```

## 3. 完整前端集成

```javascript
// utils/csrf.js

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// Fetch 封装，自动附加 CSRF Token
async function safeFetch(url, options = {}) {
  const token = getCookie('csrf-token');

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-CSRF-Token': token,
    },
    credentials: 'include',  // 发送 Cookie
  });
}

// 使用
safeFetch('/api/transfer', {
  method: 'POST',
  body: JSON.stringify({ to: 'recipient', amount: 100 }),
});
```
