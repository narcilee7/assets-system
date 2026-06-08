# 加密与传输安全

## 1. HTTPS / TLS

```
HTTP                         HTTPS
  │                            │
  ▼                            ▼
明文传输                    TLS 握手
  │                       ┌────┴────┐
  │                       │ 1. ClientHello（支持的算法）
  │                       │ 2. ServerHello + 证书
  │                       │ 3. 密钥交换（ECDHE）
  │                       │ 4. Finished（对称加密开始）
  │                       └────┬────┘
  │                            ▼
  │                        对称加密传输
  │
  ▼
中间人可截获、篡改、伪造
```

### HSTS（HTTP Strict Transport Security）

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

作用：
- 浏览器记住该域名必须使用 HTTPS
- 自动将 HTTP 请求重定向为 HTTPS（301 内部跳转）
- includeSubDomains：子域名也生效
- preload：加入浏览器内置列表
```

```javascript
// Express helmet
app.use(helmet.hsts({
  maxAge: 365 * 24 * 60 * 60,
  includeSubDomains: true,
  preload: true,
}));
```

### 证书固定（HPKP，已废弃，用 Expect-CT 替代）

```
Expect-CT: max-age=86400, enforce, report-uri="https://example.com/ct-report"

作用：要求证书必须记录在 Certificate Transparency 日志中
防止恶意 CA 签发伪造证书
```

## 2. 敏感数据存储

```javascript
// ❌ 永远不要在前端存储
localStorage.setItem('password', password);
localStorage.setItem('creditCard', cardNumber);
localStorage.setItem('privateKey', key);

// ✅ 可以存储（相对安全）
// - 非敏感的用户偏好设置
// - 公开数据缓存
// - 刷新 Token（权衡：XSS 风险 vs 用户体验）

// ✅ 更好的方案：内存中存储，页面刷新后重新获取
let accessToken = null;

function getAccessToken() {
  if (!accessToken) {
    // 用 Refresh Token 换取（HttpOnly Cookie）
    accessToken = await refreshAccessToken();
  }
  return accessToken;
}
```

## 3. Web Crypto API

```javascript
// 前端加密（谨慎使用，密钥管理是大问题）

// 生成密钥对
const keyPair = await crypto.subtle.generateKey(
  { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,  // extractable
  ['encrypt', 'decrypt']
);

// 加密
const encoded = new TextEncoder().encode('secret message');
const encrypted = await crypto.subtle.encrypt(
  { name: 'RSA-OAEP' },
  keyPair.publicKey,
  encoded
);

// 哈希（用于校验）
const hash = await crypto.subtle.digest('SHA-256', encoded);

// 随机数生成（比 Math.random 安全）
const randomBytes = crypto.getRandomValues(new Uint8Array(32));
```

## 4. 传输层安全头部

```
# 完整安全头部配置
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```
