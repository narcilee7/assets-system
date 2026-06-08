# 浏览器安全机制

## 1. 同源策略（Same Origin Policy）

```
同源 = 协议 + 域名 + 端口 完全相同

https://a.com:443/page
  │      │     │
  ▼      ▼     ▼
https  a.com  443

https://b.com/page       # 不同域 ❌
http://a.com/page        # 不同协议 ❌
https://a.com:8080/page  # 不同端口 ❌
https://sub.a.com/page   # 不同子域 ❌
```

**限制**：
- DOM 访问：不同源 iframe 无法读取内容
- Cookie：默认不发送跨域
- localStorage / IndexedDB：完全隔离
- XMLHttpRequest / fetch：默认禁止

**例外**：
- `<img>`、`<script>`、`<link>` 等标签可跨域加载
- 这就是 CSRF 和 XSS 利用的基础

## 2. CORS（跨域资源共享）

```
简单请求：GET / HEAD / POST + 安全 Header
  │
  ▼ 直接发送，浏览器自动附加 Origin Header
  服务端返回：Access-Control-Allow-Origin: https://a.com

预检请求（Preflight）：其他方法或自定义 Header
  │
  ▼ OPTIONS 预检
  服务端返回：
    Access-Control-Allow-Origin: https://a.com
    Access-Control-Allow-Methods: PUT, DELETE
    Access-Control-Allow-Headers: Content-Type, X-Custom-Header
    Access-Control-Allow-Credentials: true
    Access-Control-Max-Age: 86400
```

```javascript
// 服务端配置（Express）
const cors = require('cors');

app.use(cors({
  origin: 'https://trusted-app.com',  // ❌ 不要用 '*'
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,  // 允许携带 Cookie
  maxAge: 86400,
}));

// ❌ 危险配置
app.use(cors({ origin: true, credentials: true }));
// 任意网站都可携带 Cookie 访问你的 API
```

## 3. Secure Context

```
Secure Context = HTTPS / localhost / file://

在 Secure Context 中才可使用：
├─ Service Worker
├─ Push API
├─ Geolocation
├─ Camera / Microphone
├─ Payment Request
├─ Web Authentication (WebAuthn)
└─ 等等
```

## 4. Permissions Policy

```
Permissions-Policy:
  geolocation=(),
  microphone=(),
  camera=(),
  payment=(),
  usb=(),
  magnetometer=(),
  gyroscope=(),
  speaker-selection=()

// 允许特定域名
Permissions-Policy: camera=(self "https://trusted.com")
```

```javascript
// 运行时检查权限
const status = await navigator.permissions.query({ name: 'geolocation' });
if (status.state === 'granted') {
  navigator.geolocation.getCurrentPosition(...);
}
```

## 5. 其他浏览器安全特性

| 特性 | 作用 |
|------|------|
| **Trusted Types** | 强制所有 DOM 插入通过策略，防止 XSS |
| **Credential Management** | 安全的凭证管理 API |
| **WebAuthn** | 硬件密钥认证，无密码登录 |
| **Clear-Site-Data** | 登出时清除 Cookie、Storage、Cache |
| **Document-Policy** | 限制 JS 特性（如 document.write） |

```javascript
// Trusted Types 示例
if (window.trustedTypes && trustedTypes.createPolicy) {
  const policy = trustedTypes.createPolicy('myPolicy', {
    createHTML: (input) => DOMPurify.sanitize(input),
  });

  element.innerHTML = policy.createHTML(userInput);
}
```
