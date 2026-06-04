# Transformer 架构详解

Transformer 是现代 AI 的基石。从 2017 年的 "Attention Is All You Need" 到今天的 LLM，核心思想一脉相承。

## 原始架构

```
Encoder-Decoder 结构：

Encoder (6 layers):
  Input Embedding + Positional Encoding
  → [Multi-Head Self-Attention → Add&Norm → FFN → Add&Norm] × 6

Decoder (6 layers):
  Output Embedding + Positional Encoding
  → [Masked Self-Attention → Add&Norm → Cross-Attention → Add&Norm → FFN → Add&Norm] × 6
```

## 三种变体

### Encoder-only (BERT 风格)

```
[Embedding] → [Self-Attn → Norm → FFN → Norm] × N → [Output]
```

| 特点 | 说明 |
|------|------|
| 注意力 | 双向（看整个输入） |
| 预训练 | MLM (Masked LM)：遮罩预测 |
| 适合 | 理解任务：分类、NER、句子相似度 |
| 代表 | BERT、RoBERTa、DeBERTa、ALBERT |

### Decoder-only (GPT 风格)

```
[Embedding] → [Masked Self-Attn → Norm → FFN → Norm] × N → [Output]
```

| 特点 | 说明 |
|------|------|
| 注意力 | 因果/单向（只看过去） |
| 预训练 | 自回归：next token prediction |
| 适合 | 生成任务：文本生成、代码、对话 |
| 代表 | GPT、LLaMA、PaLM、Qwen、Claude |

### Encoder-Decoder (T5 风格)

```
Encoder: [双向 Self-Attn → FFN] × N
Decoder: [因果 Self-Attn → Cross-Attn → FFN] × N
```

| 特点 | 说明 |
|------|------|
| 注意力 | Encoder 双向，Decoder 单向 + Cross |
| 预训练 | Span Corruption：填空再生成 |
| 适合 | 翻译、摘要、需要输入理解的生成 |
| 代表 | T5、BART、UL2 |

## 为什么 LLM 都是 Decoder-only？

1. **Scaling 效率高**：同样的参数量，decoder-only 的 FLOPs 利用率更高
2. **训练简单**：只需 next token prediction，无需设计复杂的预训练目标
3. **推理统一**：训练和推理模式一致（都是自回归）
4. **涌现能力**：随着规模增大，decoder-only 展现出强大的零样本/少样本能力

## 核心组件详解

### Layer Normalization

```
LayerNorm(x) = γ · (x - μ) / √(σ² + ε) + β
```

- Pre-LN（LayerNorm 在子层前）：训练更稳定，现代模型主流
- Post-LN（LayerNorm 在子层后）：原始 Transformer，收敛需要 warmup

### FFN (Feed-Forward Network)

```
FFN(x) = max(0, xW_1 + b_1)W_2 + b_2
        = ReLU(xW_1)W_2
```

- 中间维度：4 × d_model（如 d=768，中间=3072）
- **占模型总参数的 2/3**
- 作用是逐位置的"记忆"和"变换"

### 残差连接 (Residual Connection)

```
x' = LayerNorm(x + Sublayer(x))
```

- 解决深层网络梯度消失
- 允许信息直接流过，attention 和 FFN 学习"残差"

## 现代改进

| 改进 | 原理 | 代表 |
|------|------|------|
| SwiGLU | 门控激活：`Swish(xW) ⊙ (xV)` | PaLM、LLaMA-2 |
| RMSNorm | 去掉 centering，只 scaling： `x / √(mean(x²)) · γ` | LLaMA、Qwen |
| Grouped-Query Attention | 多 query 共享 K/V，减少推理显存 | LLaMA-2-70B |
| Sliding Window Attention | 局部窗口 + 全局汇总 | Mistral |
| Mixture of Experts | 稀疏激活，条件计算 | GPT-4、Mixtral |

## 参数分布

以 GPT-3 175B 为例：

| 组件 | 参数量 | 占比 |
|------|--------|------|
| Embedding | 2 × V × d | ~6% |
| Attention | 4 × d² × L | ~12% |
| FFN | 2 × 4d × d × L | ~66% |
| LayerNorm | 2 × d × L | <1% |

V = vocab size, d = hidden dim, L = layer count

## 常见误区

| 误区 | 正解 |
|------|------|
| Encoder-only 比 Decoder-only 弱 | ❌ 只是适合的任务不同 |
| 层数越多越好 | ⚠️ 有边际递减，且训练难度增加 |
| FFN 是浪费参数 | ❌ FFN 存储了大量世界知识和模式 |
| 残差连接可有可无 | ❌ 没有残差，超过 ~20 层几乎无法训练 |

## 快速检查清单

- [ ] 能画出三种架构的对比图
- [ ] 理解为什么 Decoder-only 成为 LLM 主流
- [ ] 知道 Pre-LN 和 Post-LN 的区别
- [ ] 理解 FFN 在模型参数中的占比
