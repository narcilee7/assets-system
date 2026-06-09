# 内容安全策略（CSP）

## 1. CSP 是什么

CSP 通过 HTTP Header 告诉浏览器：哪些资源可以加载、哪些可以执行。是 XSS 的最强防护之一。

```
Content-Security-Policy: <directive> <value>; <directive> <value>
```

## 2. 指令详解

```
Content-Security-Policy:
  default-src 'self';                    # 默认只允许同源
  script-src 'self' https://cdn.js;      # JS 来源白名单
  style-src 'self' 'unsafe-inline';      # CSS 来源
  img-src 'self' data: https:;           # 图片来源
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  media-src 'self';
  object-src 'none';                     # 禁止 Flash / Java Applet
  frame-src 'self';                      # iframe 来源
  frame-ancestors 'none';                # 禁止被嵌入
  base-uri 'self';                       # <base> 标签限制
  form-action 'self';                    # 表单提交目标
  upgrade-insecure-requests;             # HTTP 自动升级 HTTPS
  block-all-mixed-content;               # 禁止混合内容
```

## 3. 从宽松到严格：渐进式部署

### 阶段 1：Report-Only（只报告，不拦截）

```
Content-Security-Policy-Report-Only:
  default-src 'self';
  report-uri /csp-report;
  report-to csp-endpoint;
```

```javascript
// 收集违规报告
app.post('/csp-report', (req, res) => {
  console.log('CSP Violation:', req.body);
  // 分析哪些资源被误拦截，调整策略
});
```

### 阶段 2：基础策略

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';  # 很多框架需要内联样式
```

### 阶段 3：严格策略

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self';
  style-src 'self';
  img-src 'self' data:;
  connect-src 'self';
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'none';
  form-action 'self';
```

### 阶段 4：Nonce / Hash（禁止所有内联脚本）

```javascript
// 服务端每次请求生成随机 nonce
const nonce = crypto.randomBytes(16).toString('base64');

// 设置 CSP Header
res.setHeader('Content-Security-Policy', `script-src 'nonce-${nonce}' 'strict-dynamic';`);

// HTML 中所有内联脚本必须带 nonce
// <script nonce="${nonce}">console.log('allowed')</script>
// <script>alert('blocked')</script>  // 没有 nonce，被拦截
```

```javascript
// Hash 方案（适用于固定的内联脚本）
const script = "console.log('hello')";
const hash = crypto.createHash('sha256').update(script).digest('base64');

// CSP: script-src 'sha256-abc123...'
// <script>console.log('hello')</script>  // hash 匹配，允许
```

## 4. CSP 与框架集成

### Next.js

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [{
        key: 'Content-Security-Policy',
        value: "default-src 'self'; script-src 'self' 'unsafe-eval';",
      }],
    }];
  },
};
```

### Nginx

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self';" always;
```
