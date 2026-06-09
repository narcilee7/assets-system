# 认证与会话安全

## 1. JWT 安全

### JWT 结构

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  <- Header (Base64Url)
eyJ1c2VyIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4ifQ.  <- Payload (Base64Url)
SflKxwRJSMeKKF2QT4fwpMe...  <- Signature

⚠️ Header 和 Payload 只是 Base64 编码，任何人都能解码！
```

### 安全陷阱

```javascript
// ❌ 在 Payload 中存放敏感信息
const payload = {
  userId: 123,
  password: 'hashed_password',  // 不要放！
  email: 'user@example.com',    // 可以解码看到
  role: 'admin',
};

// ❌ 使用 none 算法（无签名）
// 攻击者修改 Header: { "alg": "none" }，服务端如果未校验则通过

// ❌ 密钥太弱
const SECRET = 'secret';  // 极易暴力破解

// ✅ 正确用法
const payload = { sub: 'user123', iat: Date.now(), exp: Date.now() + 3600000 };
// 只放标识符和元数据，敏感数据查数据库

// ✅ 强密钥 + HS256 或 RS256
const SECRET = crypto.randomBytes(64).toString('hex');
```

### JWT 存储位置

```javascript
// ❌ localStorage（XSS 可读取）
localStorage.setItem('token', jwt);

// ✅ HttpOnly Cookie（XSS 无法读取）
// 服务端设置：
res.cookie('token', jwt, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 3600000,
});

// 但 Cookie 需要防 CSRF（见 CSRF 文档）
// 解决方案：双 Token（Access + Refresh）
// Access Token: HttpOnly Cookie（短期）
// Refresh Token: HttpOnly Cookie（长期，用于刷新 Access Token）
```

## 2. OAuth 2.1 / OIDC 安全

### PKCE（Proof Key for Code Exchange）

```
前端生成：
  code_verifier = random_string(128)
  code_challenge = base64url(sha256(code_verifier))

请求授权：
  GET /authorize?code_challenge=xxx&code_challenge_method=S256

交换 Token：
  POST /token { code, code_verifier }

⚠️ 不使用 PKCE 时，攻击者可拦截 authorization code 换取 Token
```

### 状态参数防 CSRF

```
前端生成随机 state，存入 sessionStorage

请求授权：
  GET /authorize?state=random123

回调时检查：
  if (callbackState !== sessionStorage.state) throw Error('CSRF');
```

## 3. 会话固定攻击

```
攻击者获取合法 Session ID：
  1. 访问网站获取 Session ID: abc123
  2. 诱导用户使用此 Session ID 登录（通过 URL 参数）
  3. 用户登录后，Session abc123 变为认证状态
  4. 攻击者使用 abc123 访问，获得用户权限

防护：登录成功后重新生成 Session ID
```

## 4. 密码安全（前端角度）

```javascript
// ❌ 前端明文传输密码
fetch('/login', { body: JSON.stringify({ password: '123456' }) });

// ✅ HTTPS（必须）
// ✅ 密码复杂度校验（前端）
function validatePassword(password) {
  const minLength = 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);

  return password.length >= minLength && hasUpper && hasLower && hasNumber && hasSpecial;
}

// ✅ 密码强度指示器（实时反馈）
// zxcvbn 库
import zxcvbn from 'zxcvbn';
const result = zxcvbn(password);  // score 0-4
```
