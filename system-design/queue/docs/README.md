# Queue DOCS

状态：**draft**（深度完成）

这个目录承载消息队列系统设计的完整文档，包括问题定义、API、数据模型、读写路径、失败模式、扩展、可观测和面试追问。

## 文档清单

| 文档 | 状态 | 说明 |
|------|------|------|
| problem.md | ✅ draft | 3 种传递语义、ACK 机制、DLQ、重试、顺序保证、幂等性、4 个关键决策、3 个真实踩坑 |
| api.md | ✅ draft | 队列管理、消息发送/消费/ACK/NACK、DLQ、消费者组、延迟消息 API |
| data-model.md | ✅ draft | 10 类数据模型（队列/分区/消息/消费者/DLQ/幂等表/延迟队列/副本） |
| read-write.md | ✅ draft | 消息发送/消费流程、ACK 机制、重试流程、幂等消费、顺序保证 |
| failure.md | ✅ draft | 7 种失败模式：消息丢失、重复消费、积压、重试风暴、乱序、分区不均、DLQ 积压 |
| scale.md | ✅ draft | 性能目标、4 个瓶颈（I/O、网络、副本、消费者）及优化、容量规划 |
| observability.md | ✅ draft | 三大支柱、日志/指标/Trace、告警规则、仪表盘 |
| interview.md | ✅ draft | 6 个核心追问（传递语义、ACK 时机、重试策略、幂等、积压、顺序、生产踩坑） |
