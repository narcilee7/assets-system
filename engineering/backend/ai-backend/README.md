# AI Backend Architecture

AI Backend 是你作为 AI 全栈工程师的后端差异化能力：把 Agent、RAG、Tool Calling、Eval 和 Streaming 做成可靠服务，而不是 demo。

## 核心模块

| 模块 | 后端关注点 |
| --- | --- |
| Agent Session | 状态机、事件、恢复、取消 |
| Tool Runtime | schema、权限、幂等、超时、审计 |
| RAG Service | indexing、retrieval、citation、权限过滤 |
| Eval Service | golden set、judge、回归、质量门禁 |
| Streaming Gateway | SSE、last-event-id、heartbeat、背压 |
| Memory Service | 写入策略、检索、删除、用户控制 |
| Safety Gate | 高风险动作确认、策略、沙箱 |

## 架构师级追问

- Agent 任务中断后如何恢复？
- 工具有副作用时如何保证只执行一次？
- RAG 检索如何做权限过滤？
- streaming 断线后如何继续？
- eval 如何进入 CI 或发布门禁？
- prompt、tool result、用户数据如何审计和脱敏？

## 资产

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| agent tool runtime backend | todo | tool registry、execution、audit |
| streaming event store | todo | event id、resume、retention |
| RAG permission filter | todo | tenant、doc ACL、citation |
| eval regression service | todo | case、run、report |
| high-risk tool approval | todo | confirmation、idempotency |

