# Inference Optimization

推理优化主线关注如何降低延迟、成本和显存，同时保持质量。

## 核心技术

| 技术 | 目标 |
| --- | --- |
| KV Cache | 避免重复计算历史 token |
| Continuous Batching | 提高吞吐 |
| Quantization | 降低显存和计算 |
| Speculative Decoding | 用小模型加速大模型 |
| PagedAttention | 管理 KV cache 内存 |
| Tensor Parallel | 多 GPU 切分矩阵 |
| Pipeline Parallel | 多阶段流水 |
| MoE Routing | 稀疏激活专家 |

## 资产

| 资产 | 状态 |
| --- | --- |
| KV cache walkthrough | todo |
| batching and latency tradeoff | todo |
| quantization methods comparison | todo |
| speculative decoding notes | todo |
| vLLM PagedAttention notes | todo |

