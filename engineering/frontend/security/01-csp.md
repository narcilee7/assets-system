# Content Security Policy

## 1. CSP 基础指令

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-abc123' https://cdn.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
  block-all-mixed-content;
```

| 指令 | 控制内容 |
|------|---------|
| `default-src` | 默认回退策略 |
| `script-src` | JS 执行来源（最关键） |
| `style-src` | CSS 来源 |
| `img-src` | 图片来源 |
| `connect-src` | fetch/XHR/WebSocket 目标 |
| `frame-src` | iframe 嵌入来源 |
| `object-src` | Flash/插件 |
| `base-uri` | `<base>` 标签限制 |
| `form-action` | 表单提交目标 |

## 2. Nonce 动态策略

```javascript
// 服务端生成 nonce（每个请求唯一）
const crypto = require('crypto');

function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

// Express 中间件
app.use((req, res, next) => {
  const nonce = generateNonce();
  res.locals.nonce = nonce;
  res.setHeader(
    'Content-Security-Policy',
    `script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'`
  );
  next();
});

// 模板中注入 nonce
// <script nonce="<%= nonce %>">
//   console.log('This script is allowed');
// </script>
```

## 3. 严格 CSP（Strict CSP）

```http
# 推荐配置（Google 标准）
Content-Security-Policy:
  script-src 'nonce-{random}' 'strict-dynamic' https: 'unsafe-inline';
  object-src 'none';
  base-uri 'none';

# strict-dynamic：信任由 nonce 标记的脚本加载的子脚本
# 这样无需维护完整的脚本白名单
```

## 4. Report-Only 模式（渐进部署）

```http
# 第一阶段：只报告，不阻止
Content-Security-Policy-Report-Only:
  default-src 'self';
  report-uri https://example.com/csp-report;

# 第二阶段：确认无误报后启用阻止
Content-Security-Policy:
  default-src 'self';
```

```javascript
// 收集 CSP 违规报告
app.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'];
  console.warn('CSP Violation:', {
    documentUri: report['document-uri'],
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    originalPolicy: report['original-policy'],
  });
  res.status(204).end();
});
```

## 5. 框架集成

```javascript
// Next.js (next.config.js)
const cspHeader = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
  style-src 'self' 'nonce-${nonce}';
  img-src 'self' blob: data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ];
  },
};

// Nuxt (nuxt.config.ts)
export default defineNuxtConfig({
  security: {
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'nonce-{{nonce}}'"],
        'style-src': ["'self'", "'nonce-{{nonce}}'"],
      },
    },
  },
});
```
