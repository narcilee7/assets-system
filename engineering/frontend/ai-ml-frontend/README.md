# AI/ML 前端集成工程化

AI/ML 前端集成工程化训练 —— 达到"能在浏览器运行模型、能设计 RAG 前端架构、能集成 LLM 流式对话"的水平。

## 训练哲学

1. **端侧推理是趋势**：隐私、低延迟、离线可用，推动模型跑到用户设备上。
2. **模型大小决定可行性**：7B 模型无法在浏览器运行，但 100M 的量化模型可以。
3. **流式体验是标准**：LLM 生成不能等全部完成再显示，必须逐字流式呈现。
4. **隐私是底线**：用户数据不应随意上传到第三方 API，本地推理是首选。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-ml-runtime.md](01-ml-runtime.md) | ML 运行时：TensorFlow.js / ONNX Runtime / Transformers.js 对比选型 |
| [02-model-optimization.md](02-model-optimization.md) | 模型优化：量化、剪枝、蒸馏、格式转换、模型分片 |
| [03-web-inference.md](03-web-inference.md) | Web 推理架构：WebGPU/WebGL/WASM 后端、Worker 推理、流式生成 |
| [04-rag-frontend.md](04-rag-frontend.md) | RAG 前端架构：向量检索、Embedding、文档处理、缓存策略 |
| [05-ai-sdk-integration.md](05-ai-sdk-integration.md) | AI SDK 集成：OpenAI/Claude SDK、SSE 流式、函数调用、工具调用 |
| [06-privacy-security.md](06-privacy-security.md) | AI 隐私安全：本地推理、联邦学习、数据脱敏、Prompt 注入防护 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/inference-worker.md](mini-impl/inference-worker.md) | 手写 Web Worker 推理引擎 |
| [mini-impl/streaming-chat.md](mini-impl/streaming-chat.md) | 手写 SSE 流式聊天组件 |
| [mini-impl/vector-search.md](mini-impl/vector-search.md) | 手写前端向量检索引擎 |

## AI 前端架构决策树

```
模型部署位置？
  ├─ 纯云端（API） → OpenAI/Claude/自建 API + SSE 流式
  ├─ 混合（云端大模型 + 端侧小模型） → 敏感操作本地，复杂推理云端
  └─ 纯端侧（浏览器） → Transformers.js / ONNX + WebGPU

延迟要求？
  ├─ 实时（< 100ms） → 端侧小模型 / WebGPU 加速
  ├─ 可接受（1-3s） → 云端 API + 流式输出
  └─ 离线场景 → 必须端侧

隐私要求？
  ├─ 高（医疗/金融） → 本地推理优先
  ├─ 中 → 混合架构
  └─ 低 → 云端 API

模型大小？
  ├─ < 100MB → 浏览器可行（量化后）
  ├─ 100MB-1GB → 需分片加载 + IndexedDB 缓存
  └─ > 1GB → 只能云端
```
