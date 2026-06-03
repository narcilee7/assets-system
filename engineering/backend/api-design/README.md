# API Design

API 设计训练服务之间和前后端之间的契约能力。架构师要考虑演进、兼容、错误、幂等和观测。

## 核心维度

| 维度 | 关注点 |
| --- | --- |
| Resource Modeling | 资源、动作、关系 |
| Request / Response | DTO、分页、过滤、排序 |
| Error Model | code、message、details、retryable |
| Idempotency | 幂等 key、去重窗口、状态查询 |
| Versioning | URL、header、兼容字段 |
| Contract | OpenAPI、protobuf、event schema |
| Security | auth、permission、rate limit |

## 资产

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| REST API checklist | todo | 资源、状态码、错误模型 |
| idempotent POST design | todo | 创建、支付、发送消息 |
| pagination design | todo | offset vs cursor |
| event schema design | todo | 事件版本和兼容 |
| streaming event API | todo | Agent / SSE event |

## 追问

- API 是命令式还是资源式？
- 客户端重试会不会造成重复写？
- 字段删除和语义变更如何兼容？

