# Agent Platform DOCS

状态：**draft**（深度完成）

这个目录承载 Agent 平台系统设计的完整文档，包括问题定义、API、数据模型、读写路径、失败模式、扩展、可观测和面试追问。

## 文档清单

| 文档 | 状态 | 说明 |
|------|------|------|
| problem.md | ✅ draft | 7 大功能模块（Session/Planner/Tool Runtime/Memory/Streaming/Eval/Safety）、4 个关键决策（执行模式/上下文管理/工具调用/记忆存储）、3 个真实踩坑 |
| api.md | ✅ draft | 会话管理 API、Agent 执行 API（同步/流式）、工具管理 API、记忆管理 API、评估 API、Event Contract |
| data-model.md | ✅ draft | 7 类数据模型（会话/消息/工具/记忆/计划/流状态/评估）、工具 Schema、权限模型、审计日志 |
| read-write.md | ✅ draft | 4 Phase 执行流程（上下文构建→规划→工具执行→流式输出）、工具注册表、记忆检索链路、取消与恢复 |
| failure.md | ✅ draft | 7 种失败模式：工具调用失败（重试/熔断/死循环）、上下文溢出、流式中断、记忆检索差、安全问题、输出质量下降、评估误判 |
| scale.md | ✅ draft | 性能目标、5 个瓶颈（LLM推理/工具调用/上下文构建/流式推送/评估计算）及优化、容量规划 |
| observability.md | ✅ draft | 三大支柱、日志/指标/Trace、告警规则、SLO 监控 |
| interview.md | ✅ draft | 8 个核心追问（任务规划/工具恢复/副作用防护/流式协议/质量评估/数据隔离/上下文管理/生产踩坑） |
