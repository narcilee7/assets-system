# Problem

## 需求

构建一个生产级的认证授权系统，支持多种认证协议、权限模型、Token 生命周期管理，在安全性和用户体验间取得平衡。

### 功能需求

#### 1. 认证协议（Authentication）

| 协议 | 描述 | 适用场景 |
|------|------|-----------|
| **Session-Cookie** | 服务端会话 + 客户端 Cookie | 传统 Web 应用 |
| **JWT** | 无状态 Token | API、微服务、前后端分离 |
| **OAuth2** | 第三方授权 | 第三方登录、开放平台 |
| **SAML** | 企业 SSO | 企业内网 |
| **LDAP** | 目录服务 | 企业用户集成 |

#### 2. Token 类型

| 类型 | 描述 | 生命周期 |
|------|------|----------|
| **Access Token** | 短期 Token，用于 API 访问 | 15min - 1h |
| **Refresh Token** | 长期 Token，用于续期 Access Token | 7-30 天 |
| **API Key** | 静态密钥，用于服务端调用 | 长期有效 |

#### 3. 授权模型（Authorization）

| 模型 | 描述 |
|------|------|
| **RBAC** | 基于角色的访问控制（Role-Based Access Control）|
| **ABAC** | 基于属性的访问控制（Attribute-Based Access Control）|
| **PBAC** | 基于权限的访问控制（Permission-Based Access Control）|

#### 4. Token 撤销（Token Revocation）

| 方案 | 实现 |
|------|------|
| **Token 黑名单** | Redis 存储被撤销的 Token JTI |
| **短 Token 生命周期** | Access Token 15min，过期即失效 |
| **Token 版本号** | Token 带版本号，版本升级后旧 Token 失效 |

#### 5. 多租户隔离

| 方案 | 实现 |
|------|------|
| **Tenant ID 隔离** | 每个租户独立的用户表/角色表 |
| **数据权限过滤** | 查询时自动加 tenant_id 条件 |

---

### 关键设计决策

#### 决策 1：Session vs JWT

| 维度 | Session | JWT |
|------|---------|-----|
| 存储位置 | 服务端（Redis）| 客户端（无状态）|
| 扩展性 | 需共享 Session 存储 | 天然支持分布式 |
| 撤销难度 | 难（需主动失效）| 易（短期 + 黑名单）|
| 安全性 | 依赖 Cookie HttpOnly | 依赖签名算法 |
| 性能 | 需查 Session 存储 | 无需查询 |

**推荐**：**JWT 作为默认**（分布式友好），敏感操作配合短期 Access Token。

#### 决策 2：Refresh Token 轮换策略

| 策略 | 描述 | 安全 | 用户体验 |
|------|------|------|------|
| **不轮换** | Refresh Token 长期有效 | 低 | 好（不用频繁登录）|
| **滑动窗口** | 每次续期颁发新 Refresh Token | 高 | 好 |
| **一次性** | 每次续期旧 Token 作废 | 最高 | 中（需重新登录）|

**推荐**：**滑动窗口轮换**，安全与体验平衡。

#### 决策 3：Token 撤销方案

| 方案 | 实现 | 适用场景 |
|------|------|----------|
| **短期 Token** | Access Token 15min，过期即失效 | 大多数场景 |
| **Token 版本号** | 存 user:token_version，Token 携带版本，旧版本失效 | 用户修改密码后失效 |
| **黑名单** | Redis 存被撤销的 JTI | 主动撤销 |

**推荐**：**短期 Token + Token 版本号 + 黑名单**。

---

### 真实踩坑

#### 案例 1：JWT 泄漏后无法撤销

用户 Token 被盗，黑客可以长期使用，无法主动撤销。

**教训**：短期 Token + 异常登录检测 + 黑名单。

#### 案例 2：Refresh Token 被盗用

黑客获取 Refresh Token，可以无限续期获取新 Access Token。

**教训**：Refresh Token 只用于 HTTPS、一次性轮换、设备绑定。

#### 案例 3：RBAC 权限过大导致越权

用户有"管理员"角色，权限过大，可以访问不该访问的数据。

**教训**：RBAC + ABAC 结合，敏感操作二次验证。
