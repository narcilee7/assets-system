# Data Model

## 核心设计原则

- **密码安全**：bcrypt 加密，永不明文存储
- **Token 无状态**：JWT 自包含用户信息，验证只需验签
- **会话外置**：Session 存 Redis，集中管理
- **权限最小化**：RBAC + ABAC 混合

---

## 1. 用户数据模型

### 用户表

```sql
CREATE TABLE users (
    id              VARCHAR(64) PRIMARY KEY,
    email           VARCHAR(256) NOT NULL UNIQUE,
    username        VARCHAR(128) NOT NULL UNIQUE,
    password_hash   VARCHAR(256) NOT NULL,
    password_salt   VARCHAR(32) NOT NULL,

    -- MFA
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    mfa_secret     VARCHAR(128),

    -- 状态
    status          ENUM('active', 'locked', 'disabled') DEFAULT 'active',
    failed_attempts  INT DEFAULT 0,
    locked_until    TIMESTAMP,

    -- 时间
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP,
    password_changed_at TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_status (status)
);
```

---

## 2. Token 数据模型

### JWT Payload 结构

```json
{
  "sub": "user-01HV3WWZP...",
  "jti": "token-01HV3WWZP...",
  "iat": 1717200000,
  "exp": 1717200900,
  "roles": ["user", "admin"],
  "permissions": ["read", "write"],
  "tenant_id": "tenant-abc",
  "token_version": 3
}
```

### Token 黑名单（Redis）

```
auth:token:blacklist:{jti}
  TTL: 与 Token 剩余有效期相同
  Value: "revoked"

验证时：
  EXISTS auth:token:blacklist:{jti}
  如果存在 → Token 已撤销
```

### Refresh Token（Redis）

```
auth:refresh:{user_id}:{device_id}
  Hash Fields:
    token_hash: sha256(refresh_token)
    token_version: 3
    created_at: 1717200000
  TTL: 30 天
```

### Token 版本号

```
auth:user:token_version:{user_id}
  Value: 3
  每次修改密码/登出时递增

Token Payload 携带 token_version：
  Token.version != User.token_version → 拒绝
```

---

## 3. 角色权限数据模型

### 角色表

```sql
CREATE TABLE roles (
    id          VARCHAR(64) PRIMARY KEY,
    name        VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    tenant_id   VARCHAR(64),  -- NULL 表示系统角色

    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_tenant (tenant_id)
);
```

### 权限表

```sql
CREATE TABLE permissions (
    id          VARCHAR(64) PRIMARY KEY,
    name        VARCHAR(64) NOT NULL,
    resource    VARCHAR(64) NOT NULL,
    action     VARCHAR(32) NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_resource_action (resource, action)
);
```

### 用户角色关联

```sql
CREATE TABLE user_roles (
    user_id  VARCHAR(64) NOT NULL,
    role_id  VARCHAR(64) NOT NULL,

    PRIMARY KEY (user_id, role_id)
);
```

### 角色权限关联

```sql
CREATE TABLE role_permissions (
    role_id       VARCHAR(64) NOT NULL,
    permission_id VARCHAR(64) NOT NULL,

    PRIMARY KEY (role_id, permission_id)
);
```

---

## 4. 登录设备数据模型

### 设备表

```sql
CREATE TABLE user_devices (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL,
    device_id   VARCHAR(128) NOT NULL,
    device_type VARCHAR(64),
    ip_address  VARCHAR(64),
    user_agent  TEXT,

    last_used_at TIMESTAMP,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_user_device (user_id, device_id)
);
```

---

## 5. 审计日志数据模型

### 审计日志表

```sql
CREATE TABLE auth_audit_logs (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     VARCHAR(64),

    action      VARCHAR(64) NOT NULL,
    resource   VARCHAR(128),

    ip_address  VARCHAR(64),
    user_agent  TEXT,
    device_id  VARCHAR(128),

    success     BOOLEAN,
    error_msg   TEXT,

    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
);
```
