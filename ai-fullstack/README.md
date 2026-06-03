# AI Fullstack

AI 全栈层是差异化主线。它训练从前端交互、后端运行时、工具执行、上下文检索到质量评估的完整 AI 应用工程能力。

## 主干

| 主线 | 目录 | 目标 |
| --- | --- | --- |
| Agent Runtime | `agent-runtime/` | plan、tool、event stream、human-in-the-loop |
| RAG | `rag/` | chunk、embedding、retrieval、rerank、citation |
| Tool Calling | `tool-calling/` | schema、validation、permission、result、recovery |
| Eval | `eval/` | golden set、judge、regression、quality gate |
| Streaming UI | `streaming-ui/` | SSE、增量渲染、取消、重连、状态同步 |
| Memory | `memory/` | short-term、long-term、profile、forgetting |
| Workflow Orchestration | `workflow-orchestration/` | DAG、step、retry、resume、approval |
| Model Serving | `model-serving/` | routing、fallback、quota、latency、cost |
| Observability | `observability/` | trace、token、tool span、eval dashboard |
| Safety | `safety/` | policy、confirmation、sandbox、data boundary |

## 能力闭环

```text
User Intent
-> Context / Memory
-> Planner
-> Tool Runtime
-> Model Response
-> Streaming UI
-> Eval / Trace
-> Iteration
```

## 核心资产清单

| 优先级 | 资产 | 目录 | 状态 |
| --- | --- | --- | --- |
| P0 | mini agent runtime | `agent-runtime/` | todo |
| P0 | tool calling runtime | `tool-calling/` | todo |
| P0 | SSE event protocol | `streaming-ui/` | todo |
| P0 | eval harness | `eval/` | todo |
| P1 | simple RAG pipeline | `rag/` | todo |
| P1 | memory manager | `memory/` | todo |
| P1 | workflow runner | `workflow-orchestration/` | todo |
| P1 | agent observability trace | `observability/` | todo |
| P2 | model router | `model-serving/` | todo |
| P2 | safety confirmation gate | `safety/` | todo |

## 资产完成标准

每个 AI 资产需要同时覆盖：

- API / event schema。
- 最小实现。
- 失败恢复。
- 可观测字段。
- Eval 或测试。
- 面试追问。

