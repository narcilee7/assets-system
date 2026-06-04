# API

## Auth API

### 1. 认证 API

#### 注册

```http
POST /v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "username": "username"
}
```

响应：

```json
{
  "user_id": "user-01HV3WWZP1A3B5C6D7E8F9G0H",
  "email": "user@example.com"
}
```

#### 登录

```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "device_id": "device-abc123"
}
```

响应：

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 900,
  "token_type": "Bearer",
  "user": {
    "id": "user-01HV3WWZP...",
    "email": "user@example.com",
    "roles": ["user"]
  }
}
```

#### Refresh Token 续期

```http
POST /v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

响应：

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 900
}
```

#### 登出

```http
POST /v1/auth/logout
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 修改密码

```http
PUT /v1/auth/password
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "old_password": "oldpass",
  "new_password": "newpass"
}
```

---

### 2. 授权验证 API

#### 验证 Access Token

```http
POST /v1/auth/verify
Authorization: Bearer {access_token}
```

响应：

```json
{
  "valid": true,
  "user_id": "user-01HV3WWZP...",
  "roles": ["user", "admin"],
  "permissions": ["read", "write"],
  "tenant_id": "tenant-abc",
  "expires_at": "2024-06-01T11:00:00Z"
}
```

#### 获取用户信息

```http
GET /v1/auth/userinfo
Authorization: Bearer {access_token}
```

响应：

```json
{
  "user_id": "user-01HV3WWZP...",
  "email": "user@example.com",
  "username": "username",
  "roles": ["user"],
  "tenant_id": "tenant-abc",
  "mfa_enabled": false
}
```

---

### 3. 权限 API

#### 检查权限

```http
POST /v1/auth/permissions/check
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "action": "read",
  "resource": "order:o123"
}
```

响应：

```json
{
  "allowed": true,
  "reason": "role_admin_has_permission"
}
```

---

## Event Contract

| Event | 触发时机 | 消费者 |
|-------|---------|--------|
| `auth.login.success` | 登录成功 | 统计、审计 |
| `auth.login.failure` | 登录失败 | 告警、审计 |
| `auth.token.issued` | Token 颁发 | 统计 |
| `auth.token.refreshed` | Token 刷新 | 统计 |
| `auth.token.revoked` | Token 撤销 | 审计 |
| `auth.logout` | 用户登出 | 统计、审计 |
| `auth.password.changed` | 密码修改 | 审计 |
| `auth.mfa.enabled` | 开启 MFA | 安全审计 |
