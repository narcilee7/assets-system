# Agent Runtime Architecture

Agent Runtime 不是"跑 Agent 的容器"，而是"Agent 生命周期、状态、工具、通信、观测"五大子系统的编排内核。它的设计质量直接决定 Agent 系统的上限。

```plain
┌─────────────────────────────────────────────────────────────┐
│                      Agent Runtime Core                      │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│  Lifecycle  │    State    │   Tool      │   Event Bus       │
│  Manager    │   Manager   │  Runtime    │  (Message Router) │
│             │             │             │                   │
│ • 创建/调度  │ • Working   │ • Sandbox   │ • Pub/Sub         │
│ • 抢占/恢复  │   Memory    │ • 工具注册   │ • 多播/单播        │
│ • 销毁/GC   │ • Long-term │ • 超时控制   │ • 优先级队列       │
│             │   Memory    │ • 结果缓存   │ • 背压机制         │
│             │ • Checkpoint│             │                   │
├─────────────┴─────────────┴─────────────┴───────────────────┤
│                    LLM Gateway Layer                          │
│  (模型路由 · 重试策略 · 流式处理 · Token 预算 · 并发配额)       │
├─────────────────────────────────────────────────────────────┤
│                    Observability Layer                        │
│  (分布式 Tracing · 结构化 Logging · 性能 Metrics · 成本归因)    │
└─────────────────────────────────────────────────────────────┘
```
