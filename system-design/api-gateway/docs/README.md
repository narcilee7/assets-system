# API GATEWAY DOCS

状态：**draft**（深度完成）

这个目录承载 API 网关系统设计的完整文档，包括问题定义、API、数据模型、读写路径、失败模式、扩展、可观测和面试追问。

## 文档清单

| 文档 | 状态 | 说明 |
|------|------|------|
| problem.md | ✅ draft | 需求、非功能目标、关键决策（fail-open、认证位置、路由匹配算法、插件架构选型）、真实踩坑案例 |
| api.md | ✅ draft | 管理面 API（路由/服务/插件/限流）、数据面 API（认证流程、路由匹配）、Event Contract、协议转换 API |
| data-model.md | ✅ draft | 路由配置、服务注册、限流计数、熔断器状态、插件系统、路由索引、身份上下文、日志数据模型 |
| read-write.md | ✅ draft | 请求处理主流程（5 phase）、路由匹配算法（L1/L2/L3 分层）、JWT 验证流程、限流算法（Redis Lua）、负载均衡算法、熔断器逻辑、插件链执行模型 |
| failure.md | ✅ draft | 10 种失败模式（注册中心故障、Redis 不可用、后端故障、网关单点、路由冲突、JWT 失败、熔断误判、热更新一致性、内存问题、DDoS） |
| scale.md | ✅ draft | 性能目标、5 个核心瓶颈（路由匹配、JWT、限流 Redis、连接池、插件链）及优化方案、容量规划 |
| observability.md | ✅ draft | 三大支柱（Logs/Metrics/Traces）、告警规则、SLO 监控、日志聚合架构 |
| interview.md | ✅ draft | 8 个核心追问（HA、熔断、路由一致性、限流算法选型、JWT 优化、插件架构、零信任安全、生产踩坑） |
