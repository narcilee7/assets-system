# System Design

系统设计层把单点实现升级为可讲清楚的完整系统：需求、接口、数据、读写路径、扩展、失败路径、观测和权衡。

## 案例库

| 案例 | 目录 | 状态 | 训练目标 |
| --- | --- | --- | --- |
| 大文件上传 | `file-upload/` | draft | 分片、秒传、断点续传、合并、幂等 |
| 缓存系统 | `cache/` | todo | TTL、淘汰、一致性、穿透 / 击穿 / 雪崩 |
| 消息队列 | `queue/` | todo | ack、retry、DLQ、顺序、幂等 |
| 实时系统 | `realtime/` | todo | SSE、WebSocket、心跳、重连 |
| 认证授权 | `auth/` | todo | session、JWT、RBAC、刷新、撤销 |
| 可观测平台 | `observability/` | todo | log、metric、trace、告警 |
| 搜索系统 | `search/` | todo | indexing、query、ranking、更新 |
| 推荐系统 | `recommendation/` | todo | 召回、排序、特征、反馈 |
| Feed 流 | `feed/` | todo | 推 / 拉、分页、去重、排序 |
| 短链系统 | `short-url/` | todo | ID 生成、跳转、统计、防滥用 |
| 限流系统 | `rate-limiter/` | todo | token bucket、分布式限流 |
| Agent 平台 | `agent-platform/` | todo | tool、memory、workflow、eval、权限 |

## 固定输出结构

每个系统设计案例至少包含：

```text
docs/problem.md       # 需求、非功能目标、约束
docs/api.md           # API / event contract
docs/data-model.md    # 数据模型
docs/read-write.md    # 核心读写路径
docs/failure.md       # 失败模式和恢复
docs/scale.md         # 扩展方案和瓶颈
docs/observability.md # 指标、日志、追踪、告警
docs/interview.md     # 面试追问和权衡
implementation/       # 最小实现，可选
```

## 面试讲解顺序

```text
明确需求
-> 给出核心 API
-> 画核心流程
-> 说明数据模型
-> 分析瓶颈
-> 处理失败路径
-> 讲扩展和权衡
-> 总结观测指标
```

## 优先级

| 优先级 | 案例 | 原因 |
| --- | --- | --- |
| P0 | 大文件上传 | 已有实现，最容易资产化 |
| P0 | Agent 平台 | AI 全栈差异化核心 |
| P0 | 实时系统 | SSE / Agent streaming 强相关 |
| P1 | 缓存、队列、限流 | 后端系统设计高频 |
| P1 | 认证授权、可观测 | 工程完整度核心 |

