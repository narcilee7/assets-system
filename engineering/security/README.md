# 安全工程化

安全工程化训练 —— 达到"能设计安全架构、能防御 OWASP Top 10、能实施密码学方案、能通过安全审计"的水平。

## 训练哲学

1. **安全不是附加功能**：从需求分析阶段就要引入威胁建模，安全左移。
2. **不信任任何输入**：所有外部输入都是潜在的攻击向量，必须验证、消毒、编码。
3. **最小权限原则**：每个组件、每个用户只拥有完成任务所需的最小权限。
4. **纵深防御**：单一安全措施会被突破，多层防护才能提高攻击成本。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-security-fundamentals.md](01-security-fundamentals.md) | 安全基础：OWASP Top 10、SDL、威胁建模、安全左移 |
| [02-authentication-authorization.md](02-authentication-authorization.md) | 认证授权：JWT、OAuth2/OIDC、RBAC、ABAC、SSO、MFA |
| [03-input-protection.md](03-input-protection.md) | 输入防护：SQL 注入、XSS、CSRF、命令注入、文件上传、SSRF |
| [04-cryptography.md](04-cryptography.md) | 密码学：对称加密、非对称加密、哈希、HMAC、数字签名、证书管理 |
| [05-network-security.md](05-network-security.md) | 网络安全：HTTPS/TLS、CORS、CSP、WAF、DDoS 防护 |
| [06-audit-compliance.md](06-audit-compliance.md) | 审计合规：安全日志、合规框架、渗透测试、漏洞管理 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/jwt-implementation.md](mini-impl/jwt-implementation.md) | 手写 JWT 生成与验证 |
| [mini-impl/password-hashing.md](mini-impl/password-hashing.md) | 手写密码哈希系统（PBKDF2/Argon2） |
| [mini-impl/rbac-engine.md](mini-impl/rbac-engine.md) | 手写 RBAC 权限引擎 |

## 安全决策树

```
用户身份？
  ├─ 匿名用户 → 最小权限，只允许公开资源
  ├─ 普通用户 → RBAC 角色权限
  └─ 管理员 → 额外审计日志、MFA

数据敏感度？
  ├─ 公开 → 无需加密
  ├─ 内部 → 传输层加密（TLS）
  ├─ 机密 → 传输 + 存储加密
  └─ 高度机密 → 端到端加密、零信任

部署环境？
  ├─ 本地 → 防火墙 + IDS
  ├─ 私有云 → 云安全组 + WAF
  ├─ 公有云 → 云原生安全服务
  └─ 混合 → 统一安全策略
```
