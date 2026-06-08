# 认证与授权

## 1. JWT（JSON Web Token）

```
JWT 结构
header.payload.signature

Header: {"alg":"HS256","typ":"JWT"}
Payload: {"sub":"user123","iat":1717200000,"exp":1717286400,"role":"admin"}
Signature: HMACSHA256(base64url(header) + "." + base64url(payload), secret)

签名算法：
├── HS256/HS384/HS512：对称 HMAC（服务端签名验证）
├── RS256/RS384/RS512：非对称 RSA（公钥验证）
├── ES256/ES384/ES512：非对称 ECDSA（更短密钥同等安全）
└── EdDSA：Ed25519（现代推荐）

安全要点：
├── 密钥长度 ≥ 256 bit（HS256）
├── 设置合理的 exp（过期时间）
├── 不要在 payload 放敏感数据（仅 base64 编码）
├── 使用 HTTPS 传输
├── 支持 token 刷新（refresh token）
└── 实现 token 黑名单（logout）
```

```javascript
// JWT 使用示例
const jwt = require('jsonwebtoken');

// 生成
const token = jwt.sign(
  { sub: user.id, role: user.role },
  process.env.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '15m', issuer: 'my-app' }
);

// 验证
try {
  const payload = jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],  // 明确指定允许的算法
    issuer: 'my-app',
    clockTolerance: 30,     // 时钟偏差容忍 30 秒
  });
} catch (err) {
  if (err.name === 'TokenExpiredError') {
    // 尝试用 refresh token 续期
  }
}

// Refresh Token 模式
// Access Token: 15 分钟，存内存
// Refresh Token: 7 天，存 httpOnly cookie 或安全存储
// Refresh Token 轮换：每次使用 refresh 生成新的 pair，旧 refresh 失效
```

## 2. OAuth2 / OIDC

```
OAuth2 授权流程

授权码模式（Authorization Code）—— 最安全、最常用
┌─────────┐                                    ┌─────────────┐
│  用户   │────(1) 授权请求 ───────────────────▶│  授权服务器  │
│ (浏览器) │    response_type=code               │  (IdP)      │
└─────────┘                                    └─────────────┘
     │                                               │
     │◀──(2) 登录 + 同意授权──────────────────────────┘
     │
     │──(3) 重定向到客户端，携带授权码 code──────────────▶
     │
┌─────────┐                                    ┌─────────────┐
│ 客户端  │────(4) 用 code 换 token ───────────▶│  授权服务器  │
│ (服务端)│    client_id + client_secret + code  │             │
└─────────┘                                    └─────────────┘
     │◀────────────────(5) access_token + refresh_token──────┘

其他模式：
├── 简化模式（Implicit）：直接返回 token，不安全，已废弃
├── 密码凭证（Password）：用户直接给客户端密码，不推荐
├── 客户端凭证（Client Credentials）：服务间调用
└── PKCE（Proof Key for Code Exchange）：移动端/SPA 必备
```

```
OIDC（OpenID Connect）= OAuth2 + 身份层

ID Token（JWT）：包含用户身份信息
├── sub：用户唯一标识
├── name：用户姓名
├── email：邮箱
├── email_verified：邮箱是否验证
└── nonce：防止重放攻击

UserInfo Endpoint：获取更详细的用户信息

Scopes：openid（必须）、profile、email、phone、address
```

## 3. RBAC vs ABAC

```
RBAC（基于角色的访问控制）
用户 ──▶ 角色 ──▶ 权限

示例：
用户 Alice ──▶ 角色 admin ──▶ [user:create, user:delete, order:read]
用户 Bob   ──▶ 角色 editor ──▶ [post:create, post:edit]

实现：
- 数据库：users、roles、permissions、user_roles、role_permissions
- 检查：user.hasRole('admin') 或 @RequireRole('admin')
```

```
ABAC（基于属性的访问控制）
决策 = f(主体属性, 资源属性, 操作属性, 环境属性)

示例：
允许 if:
  用户.部门 == '财务部' 
  AND 资源.类型 == '报销单'
  AND 操作 == '审批'
  AND 环境.时间 BETWEEN '09:00' AND '18:00'
  AND 环境.来源IP IN ['10.0.0.0/8']

实现：
- OPA（Open Policy Agent）+ Rego 语言
- AWS IAM Policy
- XACML
```

```go
// OPA/Rego 策略示例
package app.authz

import future.keywords.if
import future.keywords.in

# RBAC
allow if {
    input.user.role == "admin"
}

allow if {
    input.user.role == "editor"
    input.action == "read"
}

# ABAC
allow if {
    input.user.department == input.resource.department
    input.action in ["read", "update"]
}

# 时间限制
allow if {
    input.user.role == "admin"
    to_number(input.time) >= 90000    # 09:00
    to_number(input.time) <= 180000   # 18:00
}
```

## 4. MFA（多因素认证）

```
认证因素：
├── 所知（Something you know）：密码、PIN
├── 所有（Something you have）：手机、硬件密钥、智能卡
└── 所是（Something you are）：指纹、人脸、虹膜

MFA 实现方案：
├── TOTP（Time-based One-Time Password）
│   ├── 基于时间的 6 位数字码
│   ├── 使用 RFC 6238 算法
│   └── 工具：Google Authenticator、Authy、Microsoft Authenticator
├── WebAuthn / FIDO2
│   ├── 硬件密钥（YubiKey）或平台认证器（Touch ID）
│   ├── 防钓鱼（绑定域名）
│   └── 无密码（Passwordless）
├── 短信/邮件 OTP
│   ├── 用户体验好
│   └── 安全性低（SIM 交换攻击）
└── 推送通知
    ├── 手机 App 确认登录
    └── 中间人攻击风险
```

```python
# TOTP 实现（Python）
import pyotp
import qrcode

# 服务端生成密钥
secret = pyotp.random_base32()  # 保存到用户表

# 生成二维码
uri = pyotp.totp.TOTP(secret).provisioning_uri(
    name="user@example.com",
    issuer_name="MyApp"
)
qrcode.make(uri).save("qr.png")

# 验证
totp = pyotp.TOTP(secret)
is_valid = totp.verify(user_input_code, valid_window=1)  # ±30秒窗口
```
