# Security Engineering

工程安全训练 —— 覆盖应用安全、前端安全、DevSecOps 和云安全的完整安全工程化体系。

## 架构

```
engineering/security/
├── README.md                 # 本文件：安全工程化总览
├── mini-impl/                # 通用安全手写实现
│   ├── jwt-implementation.md    # JWT 生成与验证
│   ├── password-hashing.md      # 密码哈希（PBKDF2/Argon2）
│   └── rbac-engine.md           # RBAC 权限引擎
└── (索引)
    ├── backend/security/       # 后端安全（RBAC、认证授权、租户隔离）
    ├── frontend/security/      # 前端安全（CSP、XSS、CSRF、供应链）
    ├── devsecops/              # DevSecOps（SDL、SAST/DAST/SCA、容器安全）
    └── cloud-security/         # 云安全（IAM、网络隔离、数据加密、工作负载安全）
```

## 安全工程化全景

| 层级 | 领域 | 关注点 | 对应目录 |
|------|------|--------|----------|
| 应用层 | 前端安全 | XSS、CSRF、CSP、HTTPS、供应链 | `frontend/security/` |
| 应用层 | 后端安全 | 认证授权、输入校验、数据保护 | `backend/security/` |
| 交付层 | DevSecOps | SDL、自动化扫描、容器安全、事件响应 | `devsecops/` |
| 基础设施 | 云安全 | IAM、VPC、加密、K8s 安全、Serverless | `cloud-security/` |
| 通用能力 | 密码学 / 权限 | JWT、哈希、RBAC、ABAC | `security/mini-impl/` |

## 通用安全手写实现

| 实现 | 说明 | 适用语言 |
|------|------|----------|
| [JWT 生成与验证](mini-impl/jwt-implementation.md) | HS256/RS256、Base64Url、过期验证 | Node.js + Python |
| [密码哈希系统](mini-impl/password-hashing.md) | PBKDF2 + Scrypt、MCF 格式、参数升级 | Node.js + Python |
| [RBAC 权限引擎](mini-impl/rbac-engine.md) | 角色继承、通配符匹配、缓存、中间件 | Node.js + Python |

## 安全决策树

```
防御面？
  ├─ 浏览器端 → frontend/security（CSP/XSS/CSRF）
  ├─ 服务端 API → backend/security（认证/授权/注入防护）
  ├─ 交付流水线 → devsecops（SAST/DAST/SCA）
  └─ 基础设施 → cloud-security（IAM/网络/加密）

数据敏感度？
  ├─ 公开 → 基础 TLS
  ├─ 内部 → TLS + 访问控制
  ├─ 机密 → 传输+存储加密 + 审计日志
  └─ 高度机密 → 端到端加密 + 零信任 + 合规
```
