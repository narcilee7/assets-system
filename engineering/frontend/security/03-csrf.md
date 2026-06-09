# CSRF（跨站请求伪造）

## 1. 攻击原理

```
用户已登录 bank.com，Cookie 中有 Session
                          │
                          ▼
用户访问 evil.com（攻击者网站）
                          │
                          ▼
evil.com 中的代码自动提交表单到 bank.com：
  <form action="https://bank.com/transfer" method="POST">
    <input name="to" value="attacker">
    <input name="amount" value="10000">
  </form>
  <script>document.forms[0].submit()</script>
                          │
                          ▼
浏览器自动带上 bank.com 的 Cookie
                          │
                          ▼
bank.com 收到请求，验证 Cookie 通过，执行转账
```

**关键条件**：
1. 用户已登录目标网站（Cookie 有效）
2. 攻击者知道目标网站的请求格式
3. 浏览器自动发送 Cookie（SameSite 策略允许）

## 2. 防护策略

### SameSite Cookie（第一道防线）

```
Set-Cookie: session=abc123; SameSite=Strict; Secure; HttpOnly

SameSite=Strict:   完全不发送第三方 Cookie（最安全）
SameSite=Lax:      顶级导航 GET 请求可发送（默认，平衡安全与体验）
SameSite=None:     总是发送（需配合 Secure，即 HTTPS）
```

```javascript
// Express 设置 SameSite
res.cookie('session', token, {
  sameSite: 'strict',
  secure: true,
  httpOnly: true,
});
```

### CSRF Token（第二道防线）

```javascript
// 服务端生成 Token
const csrfToken = crypto.randomBytes(32).toString('hex');
req.session.csrfToken = csrfToken;

// 前端表单中嵌入
<form action="/transfer" method="POST">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  <!-- 或放在 meta 标签中 -->
</form>

// 或 AJAX 请求时从 meta 读取
const token = document.querySelector('meta[name="csrf-token"]').content;
fetch('/api/transfer', {
  method: 'POST',
  headers: { 'X-CSRF-Token': token },
  body: JSON.stringify(data),
});

// 服务端验证
if (req.body._csrf !== req.session.csrfToken) {
  return res.status(403).send('CSRF validation failed');
}
```

### 双重提交 Cookie

```javascript
// 不需要服务端存储 Token
// 1. 服务端设置 Cookie：XSRF-TOKEN=randomString
// 2. 前端从 Cookie 读取，放入请求头：X-XSRF-TOKEN=randomString
// 3. 服务端比较 Cookie 中的值和 Header 中的值

// 攻击者无法做到：
// - 读取目标域的 Cookie（同源策略）
// - 所以无法伪造正确的 Header

// Axios 自动支持
csrfCookieName: 'XSRF-TOKEN',
csrfHeaderName: 'X-XSRF-TOKEN',
```

### 自定义 Header

```javascript
// 简单有效的防护：添加自定义 Header
fetch('/api/transfer', {
  headers: {
    'X-Requested-With': 'XMLHttpRequest',  // 自定义 Header
  },
});

// 攻击者通过 form 提交无法添加自定义 Header
//（CORS preflight 会拦截跨域自定义 Header 请求）
```

## 3. 防护策略对比

| 策略 | 实现复杂度 | 安全性 | 用户体验影响 |
|------|-----------|--------|-------------|
| SameSite=Strict | 低 | 高 | 可能破坏某些跨站链接 |
| SameSite=Lax | 低 | 中 | 基本无影响 |
| CSRF Token | 中 | 高 | 需确保 Token 正确传递 |
| 双重提交 Cookie | 中 | 高 | 无额外存储 |
| 自定义 Header | 低 | 中 | 需处理 CORS |

## 4. 最佳实践

```
多层叠加：
1. SameSite=Lax（默认防御）
2. + CSRF Token（关键操作）
3. + 自定义 Header（API 请求）
4. + Referer 校验（可选增强）
```
