# Read & Write Path

## 认证核心流程

### 登录流程

```
用户输入邮箱/密码
  │
  ▼
验证密码（bcrypt 对比）
  │
  ▼
生成 Access Token（JWT）
  │
  ▼
生成 Refresh Token（随机字符串）
  │
  ▼
存储 Refresh Token（Redis）
  │
  ▼
记录登录设备
  │
  ▼
返回 Access Token + Refresh Token
```

### Token 验证流程

```
收到请求，提取 Bearer Token
  │
  ▼
验证 JWT 签名（HS256/RS256）
  │
  ▼
检查 Token 是否过期
  │
  ▼
检查 Token 版本号（与用户表对比）
  │
  ▼
检查 Token 是否在黑名单
  │
  ├── 在黑名单 → 拒绝
  │
  ▼
通过 → 提取用户信息，继续处理
```

---

## 详细实现

### 密码验证

```go
func VerifyPassword(password, hash string) bool {
    // bcrypt 对比
    err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
    return err == nil
}
```

### JWT 生成

```go
func GenerateToken(userID string, roles []string) (string, error) {
    now := time.Now()
    claims := jwt.MapClaims{
        "sub": userID,
        "jti": uuid.New().String(),
        "iat": now.Unix(),
        "exp": now.Add(15 * time.Minute).Unix(),
        "roles": roles,
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}
```

### Refresh Token 轮换

```go
func RefreshToken(oldToken string) (*TokenPair, error) {
    // 1. 验证旧 Refresh Token
    claims, err := VerifyToken(oldToken)
    if err != nil {
        return nil, err
    }

    // 2. 检查黑名单
    if IsBlacklisted(claims["jti"]) {
        return nil, ErrTokenRevoked
    }

    // 3. 撤销旧 Refresh Token
    BlacklistToken(claims["jti"])

    // 4. 生成新 Token 对
    accessToken := GenerateAccessToken(claims["sub"], claims["roles"])
    refreshToken := GenerateRefreshToken()

    // 5. 存储新 Refresh Token
    StoreRefreshToken(claims["sub"], refreshToken)

    return &TokenPair{accessToken, refreshToken}, nil
}
```

---

## RBAC + ABAC 权限检查

### RBAC 检查

```go
func CheckRBAC(userID, resource, action string) bool {
    // 1. 查询用户角色
    roles := GetUserRoles(userID)

    // 2. 查询角色权限
    for _, role := range roles {
        perms := GetRolePermissions(role)
        for _, perm := range perms {
            if perm.Resource == resource && perm.Action == action {
                return true
            }
        }
    }
    return false
}
```

### ABAC 检查

```go
func CheckABAC(userID, resource, action string, ctx map[string]interface{}) bool {
    // 例如：resource=order, action=delete, ctx={owner_id: "user-123"}

    // 1. 获取资源所有者
    owner := ctx["owner_id"]

    // 2. 获取当前用户
    currentUser := ctx["user_id"]

    // 3. 资源所有者 = 当前用户，或者用户是管理员
    if owner == currentUser {
        return true
    }

    return false
}
```

### 混合检查

```go
func CheckPermission(userID, resource, action string, ctx map[string]interface{}) bool {
    // 先 RBAC
    if CheckRBAC(userID, resource, action) {
        return true
    }

    // 再 ABAC
    return CheckABAC(userID, resource, action, ctx)
}
```

---

## Token 撤销

### 修改密码时撤销所有 Token

```go
func ChangePassword(userID, newPassword string) error {
    // 1. 更新密码
    err := UpdatePassword(userID, newPassword)
    if err != nil {
        return err
    }

    // 2. 递增 Token 版本号
    err = IncrementTokenVersion(userID)
    if err != nil {
        return err
    }

    // 3. 撤销所有 Refresh Token
    DeleteAllRefreshTokens(userID)

    return nil
}
```

### 登出时撤销 Token

```go
func Logout(userID, deviceID, accessTokenJTI string) error {
    // 1. 将 Access Token 加入黑名单
    BlacklistToken(accessTokenJTI)

    // 2. 删除 Refresh Token
    DeleteRefreshToken(userID, deviceID)

    // 3. 记录审计日志
    AuditLog(userID, "logout")

    return nil
}
```
