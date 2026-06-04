# LLM 架构详解

大语言模型的架构选择决定了其能力上限、训练效率和推理成本。

## 主流架构概览

### Decoder-only（绝对主流）

```
[Embedding] → [RMSNorm → Attention → RMSNorm → FFN] × L → [LM Head]
```

**为什么成为标准？**
1. **统一目标**：训练和推理都是 next token prediction
2. **Scaling 友好**：同样的 FLOPs 下，decoder-only 的参数量利用率更高
3. **涌现能力**：随着规模增大，零样本/少样本能力自然出现
4. **工程简单**：无需设计复杂的预训练目标或 cross-attention

### 关键超参数

| 参数 | 小型 | 中型 | 大型 | 超大型 |
|------|------|------|------|--------|
| 参数量 | 1B-3B | 7B-13B | 30B-70B | 100B+ |
| 层数 (L) | 24-32 | 32-40 | 60-80 | 80-120 |
| 维度 (d) | 2048 | 4096 | 5120-8192 | 12288+ |
| 注意力头 | 32 | 32 | 64-128 | 96+ |
| 上下文长度 | 2K-4K | 4K-8K | 8K-32K | 128K+ |
| FFN 倍数 | 4× | 4× | 4× | 4× (或 SwiGLU 约 8/3×) |

### 典型模型对比

| 模型 | 参数 | 上下文 | 注意力 | 位置编码 | 特点 |
|------|------|--------|--------|---------|------|
| GPT-3 | 175B | 2K | Dense | Learned | 开创性规模 |
| LLaMA-2 | 7B/13B/70B | 4K | GQA | RoPE | 开源标杆 |
| LLaMA-3 | 8B/70B/405B | 8K-128K | GQA | RoPE | 高质量数据 |
| Qwen2 | 0.5B-72B | 32K-128K | GQA | RoPE | 中英文优化 |
| Mistral | 7B | 32K | SWA | RoPE | 小模型高性能 |
| Mixtral | 8×7B | 32K | GQA | RoPE | MoE，47B 激活 13B |
| Gemma | 2B/7B | 8K | MQA | RoPE | Google 开源 |

## 关键架构创新

### Grouped-Query Attention (GQA)

```
标准 MHA: 每个 head 有独立的 Q, K, V
MQA:     所有 head 共享一组 K, V
GQA:     每 G 个 query head 共享一组 K, V

LLaMA-2-70B: GQA (8 query groups)
效果: 推理时 KV Cache 内存减少 ~8×，速度显著提升
```

### Sliding Window Attention (SWA)

```
每个 token 只 attend 窗口内的 token（如 4K）
+ 少数层做全局 attention

Mistral: 滑动窗口 4K + 全局汇总
效果: O(n) 复杂度近似，支持 32K+ 上下文
```

### Mixture of Experts (MoE)

```
FFN 层替换为 N 个专家，每次只激活 K 个：
y = Σ_i g_i(x) · E_i(x)

g_i: 门控网络输出（通常 Top-K 稀疏）
E_i: 第 i 个专家 FFN
```

| 模型 | 总专家 | 激活专家 | 总参数 | 激活参数 |
|------|--------|---------|--------|---------|
| Mixtral | 8 | 2 | 47B | 13B |
| GPT-4 (推测) | 8-16 | 2 | ~1.8T | ~200B |

**优势**：推理时只激活部分参数，吞吐量高
**挑战**：负载均衡（所有专家均匀使用）、通信开销

## 上下文扩展技术

| 技术 | 原理 | 代表 |
|------|------|------|
| Position Interpolation | 压缩位置编码 | LLaMA-2-Long |
| NTK-aware | 调整 RoPE base | 社区方法 |
| YaRN | 插值 + 温度 | LLaMA-2-128K |
| Ring Attention | 分块计算 attention | 长序列训练 |

## 常见误区

| 误区 | 正解 |
|------|------|
| 参数量 = 能力 | ❌ 数据质量、架构效率同样重要（LLaMA-2-13B > GPT-3 在某些任务） |
| 上下文越长越好 | ⚠️ 长上下文利用率随长度衰减（Lost in the Middle） |
| MoE 模型一定更快 | ⚠️ 激活参数量类似时更快，但负载不均衡会抵消优势 |
| 所有 LLM 架构相同 | ❌ 细节差异（Norm 位置、激活函数、PE）影响显著 |

## 快速检查清单

- [ ] 理解为什么 decoder-only 成为 LLM 主流
- [ ] 知道 GQA/MQA 的动机和效果
- [ ] 理解 MoE 的基本原理和 tradeoff
- [ ] 知道至少一种长上下文扩展方法
