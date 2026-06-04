# Attention 机制详解

Attention 是 Transformer 的核心，也是现代大模型的基石。它让模型在处理每个位置时，能"关注"输入序列的所有位置。

## 核心思想

```
传统 RNN：信息必须逐步传递，长距离依赖困难
Attention：每个位置直接 attend 所有位置，距离无关
```

## Scaled Dot-Product Attention

```
Attention(Q, K, V) = softmax(QK^T / √d_k) V

Q: queries  (batch, seq_len, d_k)
K: keys     (batch, seq_len, d_k)
V: values   (batch, seq_len, d_v)
```

### 为什么除以 √d_k？

- 当 d_k 很大时，QK^T 的数值范围变大
- softmax 输入大值 → 梯度小（饱和区）
- 缩放后，方差稳定，梯度更健康

**数学证明**：假设 Q, K 各元素独立均值为 0，方差为 1，则 QK^T 的每个元素方差为 d_k。除以 √d_k 后方差回到 1。

## Multi-Head Attention

```
MultiHead(Q, K, V) = Concat(head_1, ..., head_h) W^O
where head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)
```

| 超参数 | 典型值 | 含义 |
|--------|--------|------|
| h (heads) | 8, 12, 16, 32, 64 | 注意力头数 |
| d_k = d_model / h | 64, 128 | 每个头的维度 |
| d_model | 512, 768, 1024, 4096 | 模型总维度 |

**为什么用多 head？**
- 不同 head 可以学习不同的注意力模式
- 一些 head 关注语法，一些关注语义，一些关注位置
- 实际观察：部分 head 专门处理位置关系，部分处理共指

## 自注意力 vs 交叉注意力

| 类型 | Q 来源 | K, V 来源 | 应用 |
|------|--------|-----------|------|
| Self-Attention | 同一序列 | 同一序列 | Encoder、Decoder（因果） |
| Cross-Attention | 目标序列 | 源序列 | Seq2Seq、VLM（图像→文本） |

## 因果掩码 (Causal Mask)

Decoder-only 模型（如 GPT）需要防止看到未来信息：

```
mask[i][j] = 0 if j <= i else -inf

     j=0  1  2  3
i=0 [  0 -∞ -∞ -∞ ]   token 0 只能看自己
  1 [  0  0 -∞ -∞ ]   token 1 能看 0,1
  2 [  0  0  0 -∞ ]   token 2 能看 0,1,2
  3 [  0  0  0  0 ]   token 3 能看全部
```

## Attention 的复杂度

| 操作 | 计算复杂度 | 内存复杂度 |
|------|-----------|-----------|
| 标准 Attention | O(n² · d) | O(n²) |
| FlashAttention | ~O(n² · d) | O(n)（减少 HBM 读写） |
| 线性 Attention | O(n · d²) | O(n · d) |
| 稀疏 Attention | O(n · log n · d) | O(n · log n) |

n = 序列长度，d = 模型维度

**长序列瓶颈**：当 n = 100K 时，n² = 10B，内存和计算都不可接受。这是长上下文研究的核心动机。

## Attention Pattern 可视化

```
输入: "The cat sat on the mat because it was tired"

"it" 的 attention 分布:
- 强: "cat" (共指)
- 中: "sat", "tired" (语义相关)
- 弱: "mat", "because" (语法功能词)
```

## 常见误区

| 误区 | 正解 |
|------|------|
| Attention 是解释性工具 | ⚠️ Attention 权重 ≠ 模型"认为"什么重要，只是计算图的一部分 |
| Multi-head 必须平均注意力 | ❌ 不同 head 有专业化分工，有的关注局部，有的关注全局 |
| Attention 解决了长距离依赖 | ⚠️ 理论上可以，但深层网络仍有信息稀释问题 |
| Cross-attention 只用于翻译 | ❌ VLM、TTS、多模态中都广泛使用 |

## 快速检查清单

- [ ] 能写出 scaled dot-product attention 的公式并解释缩放原因
- [ ] 理解 multi-head 中 W^Q, W^K, W^V, W^O 的作用
- [ ] 能画出因果掩码的矩阵
- [ ] 知道标准 attention 的复杂度瓶颈在哪里
