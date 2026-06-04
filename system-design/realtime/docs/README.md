# Realtime DOCS

状态：**draft**（深度完成）

这个目录承载实时通信系统设计的完整文档，包括问题定义、API、数据模型、读写路径、失败模式、扩展、可观测和面试追问。

## 文档清单

| 文档 | 状态 | 说明 |
|------|------|------|
| problem.md | ✅ draft | 需求、协议对比（WebSocket vs SSE）、4 个关键设计决策（协议选择、状态存储、消息路由、消息 ID）、4 个真实踩坑案例 |
| api.md | ✅ draft | WebSocket/SSE 连接建立、消息格式（文本/流式）、房间订阅、心跳协议、错误码、重连补发、管理面 API |
| data-model.md | ✅ draft | 9 类数据模型（连接状态、消息存储、房间订阅、流式输出、Presence、Snowflake、ACK、连接度量、离线索引） |
| read-write.md | ✅ draft | 消息推送流程、连接建立、心跳机制、流式输出、断连重连补发、房间广播（跨节点）、消息排序 |
| failure.md | ✅ draft | 10 种失败模式（连接风暴、消息丢失、乱序、流中断、内存泄漏、Redis不可用、分区、心跳误判、WebSocket失败、重复送达） |
| scale.md | ✅ draft | 性能目标、5 个核心瓶颈（连接内存、广播性能、Redis路由、流式token、心跳CPU）及优化方案、容量规划 |
| observability.md | ✅ draft | 三大支柱（Logs/Metrics/Traces）、Prometheus 指标体系、告警规则、SLO 监控 |
| interview.md | ✅ draft | 9 个核心追问（协议选型、可靠送达、消息乱序、断连检测、大房间广播、流式输出、断连重连补发、水平扩展、生产踩坑） |
