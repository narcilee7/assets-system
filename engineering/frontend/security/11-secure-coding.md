# 安全编码规范

## 1. 输入校验（白名单原则）

```javascript
// ❌ 黑名单（容易遗漏）
const isSafe = !input.includes('<script>');

// ✅ 白名单（明确允许什么）
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em'];
const ALLOWED_URLS = /^https:\/\/(www\.)?example\.com/;
const ALLOWED_ROLES = ['user', 'editor', 'admin'];

// Schema 校验
import { z } from 'zod';

const UserInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  role: z.enum(['user', 'editor', 'admin']),
});

const result = UserInput.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.issues });
}
```

## 2. 输出编码

```javascript
// 根据输出上下文选择编码方式
function encodeForHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function encodeForJs(str) {
  return JSON.stringify(str);  // 最安全的方式
}

function encodeForUrl(str) {
  return encodeURIComponent(str);
}

function encodeForCss(str) {
  // CSS 只允许特定字符
  return str.replace(/[^a-zA-Z0-9-_]/g, '');
}
```

## 3. Secrets 管理

```bash
# .env 文件（不提交到 Git）
DATABASE_URL=postgres://...
API_KEY=sk-...
JWT_SECRET=...

# .env.example（提交，作为模板）
DATABASE_URL=
API_KEY=
JWT_SECRET=

# .gitignore
.env
.env.local
.env.*.local
```

```javascript
// 运行时校验必要的环境变量
const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// ❌ 不要在代码中硬编码
const API_KEY = 'sk-live-abc123';  // 危险！

// ❌ 不要在前端暴露服务端密钥
// 前端 .env 必须以 REACT_APP_ / NEXT_PUBLIC_ 等前缀暴露，要意识到这是公开的
```

## 4. 安全头部完整配置

```javascript
// Express + Helmet
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-abc123'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.example.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: false,  // 现代浏览器 CSP 已替代
}));
```

## 5. 安全编码检查清单

- [ ] 所有用户输入都经过校验（白名单）
- [ ] 所有输出都经过编码（根据上下文）
- [ ] 不使用 `eval`、`new Function`、`setTimeout(string)`
- [ ] 不使用 `innerHTML` / `document.write`，除非已过滤
- [ ] Cookie 设置 `HttpOnly`、`Secure`、`SameSite`
- [ ] 敏感数据不存 localStorage
- [ ] 使用 HTTPS + HSTS
- [ ] 设置 CSP（至少 `default-src 'self'`）
- [ ] 设置 X-Frame-Options 或 CSP frame-ancestors
- [ ] 依赖定期审计（npm audit）
- [ ] 环境变量不硬编码，不泄露到前端
- [ ] Source map 不部署到生产环境
