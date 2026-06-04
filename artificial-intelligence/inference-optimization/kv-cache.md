# KV Cache

KV Cache 是 LLM 推理优化的基石。理解它的原理和限制对高效部署至关重要。

## 为什么需要 KV Cache？

```
自回归生成过程：

Step 1: "今天" → 计算并生成 "天气"
Step 2: "今天 天气" → 计算并生成 "很好"
Step 3: "今天 天气 很好" → 计算并生成 "!"

问题：每步都要重新计算之前所有 token 的 K, V
解决：缓存之前计算的 K, V，只计算新 token 的
```

## 原理

```
Attention(Q, K, V) = softmax(QK^T / √d) V

生成第 t 个 token 时：
  Q_t: 只来自当前 token  (1 × d)
  K_{≤t}: 来自所有历史 token  (t × d)
  V_{≤t}: 来自所有历史 token  (t × d)

缓存 K_cache, V_cache:
  新 K_t, V_t → append 到 cache
  Attention = softmax(Q_t · [K_cache | K_t]^T / √d) · [V_cache | V_t]
```

## 显存占用

```
每层 KV Cache 大小：
2 (K+V) × num_layers × num_kv_heads × seq_len × head_dim × bytes

示例：LLaMA-2-7B
- layers: 32
- kv_heads: 32 (MQA/GQA 前)
- head_dim: 128
- bytes: 2 (FP16)

Per token: 2 × 32 × 32 × 128 × 2 = 524KB
4K context: 2GB
32K context: 16GB
```

## GQA/MQA 的影响

| 注意力类型 | KV Heads | 每 Token KV Cache | 4K 显存 |
|-----------|----------|------------------|---------|
| MHA | 32 | 524KB | 2GB |
| GQA (8 groups) | 8 | 131KB | 512MB |
| MQA | 1 | 16KB | 64MB |

**GQA 成为主流的原因**：推理时 KV Cache 内存减少 4-8×，显著提升 batch size 和吞吐量。

## PagedAttention

```
问题：KV Cache 是变长的，内存分配困难
- 预分配最大长度 → 浪费
- 动态分配 → 内存碎片

PagedAttention 解决：
- 将 KV Cache 分块（block，如 16 tokens）
- 像 OS 虚拟内存一样管理
- 非连续存储，通过 block table 映射

效果：
- 减少内存浪费（内部碎片）
- 支持共享（如 beam search、并行采样）
- 支持动态扩展
```

## 前缀缓存 (Prefix Caching)

```
场景：多轮对话、批量处理相同前缀

System Prompt + 长上下文 → 前缀对所有请求相同
→ 只计算一次，所有请求共享前缀 KV Cache

vLLM 和 SGLang 支持此优化
效果：共享前缀的请求首 token 延迟大幅降低
```

## 常见误区

| 误区 | 正解 |
|------|------|
| KV Cache 减少计算量 | ❌ 只减少重复计算，attention 的 O(n) 部分仍在 |
| KV Cache 只和模型大小有关 | ❌ 主要和 seq_len × layers × kv_heads 有关 |
| MQA 总是比 MHA 好 | ⚠️ 推理好，但训练时 MHA 质量略优 |
| KV Cache 可以无限增长 | ❌ 显存是硬限制，需要量化/压缩 |

## 快速检查清单

- [ ] 理解 KV Cache 为什么能加速自回归生成
- [ ] 能估算给定模型的 KV Cache 显存占用
- [ ] 知道 GQA/MQA 对 KV Cache 的影响
- [ ] 理解 PagedAttention 的核心思想
