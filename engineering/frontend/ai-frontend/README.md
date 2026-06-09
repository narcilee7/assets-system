# AI 前端工程化

AI 前端工程化训练 —— 达到"能集成 AI SDK 构建智能应用、能设计流式响应 UI、能编排 AI 工作流、能在浏览器端运行大模型"的水平。

## 训练哲学

1. **流式响应是用户体验的底线**：用户等待完整响应的体验等同于等待页面加载，流式输出是 AI 应用的标配。
2. **结构化输出是工程化的关键**：让 AI 返回 JSON / 组件树而非纯文本，才能驱动 UI 渲染。
3. **Tool Calling 是 AI 的"手"**：没有工具调用的 AI 只是聊天机器人，有工具调用的 AI 才能完成任务。
4. **端侧推理是隐私和成本的解药**：WebLLM 让大模型在浏览器运行，数据不出域、零 API 成本。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-ai-sdk-integration.md](01-ai-sdk-integration.md) | AI SDK 集成：Vercel AI SDK、OpenAI SDK、多提供商抽象 |
| [02-streaming-ui.md](02-streaming-ui.md) | 流式响应 UI：SSE、ReadableStream、打字机效果、流式渲染 |
| [03-generative-ui.md](03-generative-ui.md) | 生成式 UI：结构化输出、AI 生成组件、React Server Components + AI |
| [04-ai-workflow.md](04-ai-workflow.md) | AI 工作流：Agent 模式、Tool Calling、多轮对话状态管理 |
| [05-frontend-llm.md](05-frontend-llm.md) | 端侧大模型：WebLLM、Transformers.js、ONNX Runtime Web |
| [06-rag-frontend.md](06-rag-frontend.md) | RAG 前端实现：向量检索、知识库 UI、Embedding 前端化 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/ai-chat-component.md](mini-impl/ai-chat-component.md) | 手写 AI 聊天组件（流式/工具调用/多模态） |
| [mini-impl/streaming-parser.md](mini-impl/streaming-parser.md) | 手写流式响应解析器（SSE / JSON Stream） |
| [mini-impl/tool-calling-engine.md](mini-impl/tool-calling-engine.md) | 手写 Tool Calling 引擎 |

## AI 前端架构决策树

```
响应方式？
  ├─ 流式（Streaming）→ SSE / ReadableStream
  └─ 非流式 → 普通 HTTP 请求

输出格式？
  ├─ 纯文本 → 简单文本渲染
  ├─ Markdown → Markdown 渲染器
  ├─ 结构化 JSON → JSON Schema 校验 + UI 映射
  └─ 组件树 → React/Vue 动态组件渲染

模型位置？
  ├─ 服务端（API）→ SDK 调用 + 流式转发
  ├─ 浏览器端（WebLLM）→ WASM + WebGPU
  └─ 混合 → 小模型端侧，大模型云端

需要工具调用？
  ├─ 是 → Tool Calling 协议 + 前端工具注册
  └─ 否 → 纯对话模式

需要记忆？
  ├─ 是 → 对话历史管理 + 上下文压缩
  └─ 否 → 单轮请求

多模态？
  ├─ 是 → 图片/音频/视频输入 + 多模态模型
  └─ 否 → 纯文本
```
