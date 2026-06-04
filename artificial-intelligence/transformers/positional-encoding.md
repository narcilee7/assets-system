# 位置编码

Transformer 没有循环或卷积结构，位置编码 (Positional Encoding, PE) 是注入序列位置信息的唯一方式。

## 为什么需要位置编码？

```
自注意力是位置无关的（permutation invariant）：
"我爱你" 和 "你爱我" 如果不加位置信息，attention 计算结果相同
```

## 经典方法

### 绝对位置编码 (Sinusoidal)

```
PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
```

**优点**：
- 无限外推（理论上任意长度）
- 相对位置可表达：`PE(pos+k)` 是 `PE(pos)` 的线性变换

**缺点**：
- 外推效果差（训练时没见过长位置）
- 位置信息在深层可能被稀释

### 可学习位置编码

```
直接学习一个嵌入矩阵: PE[pos] = W_pos[pos]
```

- BERT、GPT 早期使用
- 外推能力差（超过训练长度就未定义）
- 通常设置最大长度（如 512、1024）

## 相对位置编码

### RoPE (Rotary Position Embedding)

```
将 Q, K 的每对维度做旋转：
[q_0, q_1] → [q_0·cos(mθ) - q_1·sin(mθ), q_0·sin(mθ) + q_1·cos(mθ)]

其中 m 是位置，θ 是频率
```

**核心思想**：通过旋转编码位置，使得内积自然包含相对位置信息：
```
<f(q,m), f(k,n)> = g(q, k, m-n)
```

**使用模型**：LLaMA、PaLM、ChatGLM 等现代 LLM 的标准选择。

### ALiBi (Attention with Linear Biases)

```
在 attention score 上直接加位置偏置：
score = QK^T / √d + bias(m-n)
bias = -|m-n| · slope
```

- 每个 head 有不同的 slope
- **外推能力极强**，训练时用短序列，推理时直接外推到长序列
- BLOOM、MPT 使用

## 位置编码对比

| 方法 | 类型 | 外推能力 | 代表模型 |
|------|------|---------|---------|
| Sinusoidal | 绝对 | 弱 | 原版 Transformer |
| Learned | 绝对 | 无 | BERT、GPT-2 |
| RoPE | 相对 | 中 | LLaMA、PaLM、Qwen |
| ALiBi | 相对 | 强 | BLOOM、MPT |
| xPos | 相对 | 强 | 改进版 RoPE |
| NTK-aware | 相对 | 强 | 动态调整 RoPE base |

## 长上下文外推技术

| 技术 | 原理 | 效果 |
|------|------|------|
| Position Interpolation | 将位置编码线性压缩 | 直接外推 2-8× |
| NTK-aware | 调整 RoPE 的 base 频率 | 更平滑的外推 |
| YaRN | 结合温度缩放和插值 | 64K+ 上下文 |
| Dynamic NTK | 推理时动态调整 | 无需微调 |

## 常见误区

| 误区 | 正解 |
|------|------|
| 位置编码只在输入层加 | ❌ 现代模型在每层都加（如 GPT-NeoX）或融合到 Q/K（RoPE） |
| RoPE 可以无限外推 | ⚠️ 比可学习 PE 好，但超过训练长度性能仍下降 |
| 长上下文 = 位置编码能解决 | ❌ 位置编码只是必要条件，attention 复杂度和显存才是瓶颈 |

## 快速检查清单

- [ ] 理解为什么 Transformer 需要位置编码
- [ ] 能写出正弦位置编码的公式
- [ ] 理解 RoPE 的核心思想（旋转 + 相对位置）
- [ ] 知道至少两种长上下文外推方法
