# Failure Mode

## F1: Token 泄漏

### 场景

Access Token 被盗用，攻击者可以冒充用户操作。

### 应对策略

#### 1. 短期 Token

```
Access Token 有效期：15min
即使泄漏，最多使用 15min
```

#### 2. 黑名单

```
Token 加入黑名单
Redis: auth:token:blacklist:{jti} = "revoked"
TTL = Token 剩余有效期
```

#### 3. 异常检测

```go
// 检测异常登录
if IsAnomalousLogin(userID, device, IP) {
    // 锁定账号、发送告警
    LockAccount(userID)
    SendSecurityAlert(userID, "异常登录")
}
```

---

## F2: 密码暴力破解

### 场景

攻击者尝试大量密码登录。

### 应对策略

#### 1. 限流

```go
// 同一 IP 5 分钟内最多 5 次登录
key := "login:fail:" + IP
count := Incr(key)
Expire(key, 5 * time.Minute)
if count > 5 {
    return ErrTooManyAttempts
}
```

#### 2. 账户锁定

```go
// 5 次失败后锁定账户
if user.FailedAttempts >= 5 {
    LockAccount(userID)
}
```

#### 3. MFA 保护

```
敏感操作需要二次验证
手机验证码 / TOTP
```

---

## F3: Refresh Token 被盗用

### 场景

攻击者获取 Refresh Token，可以无限续期获取新 Access Token。

### 应对策略

#### 1. 设备绑定

```go
// Refresh Token 与 device_id 绑定
tokenHash := sha256(refreshToken + deviceID)
```

#### 2. 一次性轮换

```go
// 使用 Refresh Token 后立即颁发新 Token
// 旧 Token 作废
```

#### 3. HTTPS 强制

```
Refresh Token 只能通过 HTTPS 传输
```

---

## F4: 权限过大（越权）

### 场景

用户角色权限过大，可以访问不该访问的数据。

### 应对策略

#### 1. RBAC + ABAC 混合

```go
// RBAC 检查角色权限
// ABAC 检查数据归属
```

#### 2. 敏感操作二次验证

```go
// 删除/导出等操作需要 MFA
if IsSensitiveAction(action) && !HasMFA(userID) {
    return ErrMFARequired
}
```

---

## F5: JWT 验证失败

### 场景

| 场景 | 原因 |
|------|------|
| 签名不匹配 | 密钥不一致 |
| Token 过期 | exp 已过 |
| Token 未生效 | nbf 太早 |
| 格式错误 | Claims 缺失 |

### 应对策略

```go
func VerifyToken(tokenString string) (jwt.MapClaims, error) {
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, ErrUnexpectedSigningMethod
        }
        return []byte(os.Getenv("JWT_SECRET")), nil
    })

    if err != nil {
        return nil, err
    }

    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok || !token.Valid {
        return nil, ErrInvalidToken
    }

    return claims, nil
}
```
