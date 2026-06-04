# Auth DOCS

状态：**draft**（深度完成）

这个目录承载认证授权系统设计的完整文档，包括问题定义、API、数据模型、读写路径、失败模式、扩展、可观测和面试追问。

## 文档清单

| 文档 | 状态 | 说明 |
|------|------|------|
| problem.md | ✅ draft | 认证协议、Token 类型、RBAC/ABAC、Token 撤销、多租户隔离、3 个真实踩坑 |
| api.md | ✅ draft | 登录/注册/登出、Token 验证、OAuth2、权限 API |
| data-model.md | ✅ draft | 用户表、JWT Payload、Token 黑名单、Refresh Token、RBAC 模型、审计日志 |
| read-write.md | ✅ draft | 登录/验证流程、Token 生成、RBAC+ABAC 检查、Token 撤销 |
| failure.md | ✅ draft | 5 种失败：Token 泄漏、暴力破解、Refresh 盗用、权限过大、JWT 验证失败 |
| scale.md | ✅ draft | 性能目标、bcrypt 优化、Redis 瓶颈、容量规划 |
| observability.md | ✅ draft | 登录日志、Token 指标、告警规则、仪表盘 |
| interview.md | ✅ draft | 5 个核心追问：Session/JWT 选型、Refresh 轮换、Token 撤销、RBAC/ABAC、多租户隔离 |

