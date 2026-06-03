# Go Mini Runtime

这一层把 Go 的基础机制组合成小系统。目标不是造生产轮子，而是理解服务端基础设施的核心抽象。

## 推荐项目

| 项目 | 文件 / 目录 | 状态 | 关键点 |
| --- | --- | --- | --- |
| mini router | `mini_router/` | todo | path match、middleware、params |
| mini task queue | `mini_task_queue/` | todo | worker、retry、ack |
| mini scheduler | `mini_scheduler/` | todo | timer、ticker、context |
| mini cache with TTL | `mini_cache_ttl/` | todo | map、mutex、cleanup |
| mini pubsub | `mini_pubsub/` | todo | subscription、fan-out、close |
| mini agent tool runner | `mini_agent_tool_runner/` | todo | tool registry、context、event |
| SSE server | `sse_server/` | todo | flush、heartbeat、cancel |
| health + metrics endpoint | `health_metrics/` | todo | readiness、latency、counter |

## 第一阶段建议

先做 `mini_agent_tool_runner`，因为它能连接 AI 全栈主线：

```text
tool registry
-> validate input
-> execute with context
-> stream events
-> handle timeout / cancellation
-> return structured result
```

