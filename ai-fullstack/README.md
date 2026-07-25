# AI Fullstack

AI 全栈层是差异化主线。它训练从前端交互、后端运行时、工具执行、上下文检索到质量评估的完整 AI 应用工程能力。

## 认知地图

```text
User Intent
  → Context / Memory（短期上下文 + 长期记忆）
  → Planner（ReAct / Plan-and-Execute / Reflexion）
  → Tool Runtime（schema / validation / idempotency / safety）
  → Model Response
  → Streaming UI（SSE / event / cancel / reconnect）
  → Eval / Trace / Observability
  → Iteration
```

## 主干

| 主线 | 目录 | 目标 | 面试文档 |
| --- | --- | --- | --- |
| AI Infra | `ai-infra/` | Wandb / Weave 工程平台化、SDK/Server/Frontend 端到端设计 | [`interview.md`](ai-infra/interview.md) |
| Case Studies | `case-studies/` | 真实 AI 产品架构剖析 | [`README.md`](case-studies/README.md) |
| Agent Runtime | `agent-runtime/` | plan、tool、event stream、human-in-the-loop | [`interview.md`](agent-runtime/interview.md) |
| RAG | `rag/` | chunk、embedding、retrieval、rerank、citation | [`interview.md`](rag/interview.md) |
| Tool Calling | `tool-calling/` | schema、validation、permission、result、recovery | [`interview.md`](tool-calling/interview.md) |
| Eval | `eval/` | golden set、judge、regression、quality gate | [`interview.md`](eval/interview.md) |
| Streaming UI | `streaming-ui/` | SSE、增量渲染、取消、重连、状态同步 | [`interview.md`](streaming-ui/interview.md) |
| Memory | `memory/` | short-term、long-term、profile、forgetting | [`interview.md`](memory/interview.md) |
| Workflow Orchestration | `workflow-orchestration/` | DAG、step、retry、resume、approval | [`interview.md`](workflow-orchestration/interview.md) |
| Model Serving | `model-serving/` | routing、fallback、quota、latency、cost | [`interview.md`](model-serving/interview.md) |
| Observability | `observability/` | trace、token、tool span、eval dashboard | [`interview.md`](observability/interview.md) |
| Safety | `safety/` | policy、confirmation、sandbox、data boundary | [`interview.md`](safety/interview.md) |

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
| P0 | AI Infra 面试 QA | `ai-infra/interview.md` | done |
| P0 | Agent Runtime 面试 QA | `agent-runtime/interview.md` | done |
| P0 | Tool Calling 面试 QA | `tool-calling/interview.md` | done |
| P0 | Streaming UI 面试 QA | `streaming-ui/interview.md` | done |
| P0 | Eval 面试 QA | `eval/interview.md` | done |
| P1 | RAG 面试 QA | `rag/interview.md` | done |
| P1 | Memory 面试 QA | `memory/interview.md` | done |
| P1 | Workflow Orchestration 面试 QA | `workflow-orchestration/interview.md` | done |
| P1 | Observability 面试 QA | `observability/interview.md` | done |
| P2 | Model Serving 面试 QA | `model-serving/interview.md` | done |
| P2 | Production AI Agent 架构剖析 | `case-studies/production-ai-agents.md` | done |
| P2 | Safety 面试 QA | `safety/interview.md` | done |
| P2 | 综合面试题 | `interview-roadmap.md` | done |

## 学习路径

### 路径 A：从运行时到全栈

```text
Tool Calling（怎么安全调用工具）
  → Agent Runtime（怎么规划、执行、恢复）
    → Streaming UI（怎么流式展示给用户）
      → Eval（怎么知道好不好）
        → Observability（怎么排查问题）
          → RAG / Memory / Workflow（扩展能力）
            → Model Serving / Safety（治理与规模化）
```

### 路径 B：面试快速准备

```text
interview-roadmap.md 综合题
  → 每个模块 interview.md 的「开放设计题」
    → case-studies/production-ai-agents.md 真实架构对照
      → 重点复习失败路径和跨模块关系
```

## 核心追问

每个 AI 设计都要能回答：

```text
用户意图怎么理解？
需要哪些上下文和记忆？
Planner 怎么决策？会不会陷入循环？
工具调用如何幂等、如何恢复？
高风险操作如何确认？
流式输出如何取消和重连？
回答错了怎么发现？
如何评估和回归？
数据边界在哪里？
成本怎么控制？
```

## 与其他主线的关系

- `language/typescript/`：前端/全栈实现基础，类型驱动的 API 设计。
- `engineering/backend/`：服务边界、数据一致性、可观测性工程化。
- `systems-engineering/distributed-systems/`：消息、一致性、容错。
- `artificial-intelligence/llm/`：LLM 原理、 prompting、 fine-tuning。

## 状态说明

当前状态：11 个模块的面试深度文档已完成，覆盖核心概念、架构、失败路径、面试题、开放设计题和跨模块综合题。

下一步可选方向：
- 为 P0 模块补充最小代码实现（Agent Runtime / Tool Calling / Streaming UI / Eval）。
- 为 RAG / Memory / Workflow 补充可运行 demo。
- 建立端到端 eval golden set 和 trace 示例。
