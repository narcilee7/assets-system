# Node.js AI Backend

Node.js 非常适合做 AI 全栈里的 BFF、Streaming Gateway、Tool Runtime 和 Workflow API。

## 核心模块

| 模块 | 关键点 |
| --- | --- |
| Streaming Gateway | SSE、WebSocket、resume、heartbeat |
| Tool Runtime | schema、permission、timeout、idempotency |
| RAG API | retrieval、citation、ACL |
| Eval API | run、report、quality gate |
| Workflow API | step、retry、approval |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| Agent streaming gateway | `streaming-gateway/` | SSE + OpenAI stream、心跳、tool_call 事件 |
| Tool calling executor | `tool-runtime/` | Tool Registry、参数校验、超时控制、权限检查 |
| RAG API | `rag-api/` | Embedding、PGVector、检索、引用溯源、Streaming |
| Workflow API | `workflow-api/` | 状态机、步骤编排、人工审批、持久化 |
| Eval API | `eval-api/` | 准确率、LLM-as-a-Judge、CI 门禁 |
