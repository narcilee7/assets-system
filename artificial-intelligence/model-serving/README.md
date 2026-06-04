# Model Serving

模型服务主线关注 GPU、Serving 引擎、并行、调度、成本和稳定性。

## 生态

| 工具 | 重点 |
| --- | --- |
| vLLM | PagedAttention、continuous batching |
| TGI | Hugging Face serving |
| Triton | GPU inference server |
| TensorRT-LLM | NVIDIA 优化 |
| llama.cpp | CPU / edge / quantized inference |
| Ray Serve | distributed serving |

## 核心问题

- 如何估算显存？
- prefill 和 decode 的瓶颈分别是什么？
- batch size 如何影响 latency 和 throughput？
- 多租户如何隔离配额？
- 模型服务如何降级和 fallback？

## 资产

| 资产 | 状态 |
| --- | --- |
| [服务架构详解](./serving-architecture.md) | ✅ |
| [GPU 显存估算](./gpu-memory.md) | ✅ |
