# 预训练目标函数

预训练目标决定了模型从数据中学习什么。不同的目标函数塑造了模型不同的能力偏向。

## 语言建模目标

### 自回归语言建模 (Causal LM)

```
目标：预测下一个 token

L = -Σ log P(x_t | x_{<t}; θ)

例如："今天 天气 很好"
      预测 "天气" 给定 "今天"
      预测 "很好" 给定 "今天 天气"
```

**优点**：
- 训练简单，只需前向传播
- 推理和训练一致
- 天然适合生成任务

**缺点**：
- 只能利用单向上下文
- 对理解任务不是最优

### 掩码语言建模 (MLM)

```
目标：预测被遮罩的 token

L = -Σ_{m∈M} log P(x_m | x_{\M}; θ)

例如："今天 [MASK] 很好"
      预测 "天气"
```

**优点**：
- 双向上下文，理解能力强
- BERT 的成功基础

**缺点**：
- 预训练和微调不一致（[MASK] 在下游不出现）
- 生成任务需要额外适配

### Prefix LM / Encoder-Decoder

```
目标：编码前缀，自回归生成后续

输入：[前缀] → 编码器（双向）
输出：[后续] → 解码器（自回归）

例如 T5："今天 <X> 很好" → 生成 "天气"
```

**优点**：
- 灵活的任务转换
- 翻译、摘要等 seq2seq 任务天然适合

## 为什么 Next Token Prediction 能产生通用能力？

```
核心洞察：预测下一个 token 是一个"万能任务"

要预测好，模型必须学会：
- 语法：词性、句法结构
- 语义：词义、指代、推理
- 世界知识：事实、常识
- 推理：逻辑、数学、代码
- 风格：文体、语气、格式

因为自然语言编码了人类的大部分知识
```

## 多任务预训练

### UL2 (Unifying Language Learning)

```
混合多种目标：
- R-denoising：长 span 掩码（类似 T5）
- S-denoising：短 span 掩码（类似 BERT）
- X-denoising：极端掩码（类似前缀 LM）

用 mode switch token 切换任务
```

### 代码预训练目标

```
标准：仍是 next token prediction
特殊：
- FIM (Fill-In-The-Middle)：把代码中间部分遮罩
  <fim_prefix>def sort(<fim_suffix>):<fim_middle>
  → 预测参数列表

- 因果掩码：保持自回归性质
```

## Scaling Law

```
Loss ≈ C / (N^α · D^β) + L_∞

N: 模型参数量
D: 训练 token 数
α ≈ 0.34, β ≈ 0.28
L_∞: 不可约损失

关键发现（Chinchilla）：
- 最优比例：D ≈ 20 × N（tokens 是参数量的 20 倍）
- 之前的模型（如 GPT-3）严重 undertrained
- LLaMA：用更多数据训练较小模型，效率更高
```

## 训练稳定性

### 常见问题

| 问题 | 现象 | 解决 |
|------|------|------|
| Loss Spike | loss 突然增大 | gradient clipping、减小 lr、检查数据 |
| NaN | 梯度或参数变为 NaN | mixed precision 检查、减小 lr、增大 eps |
| 梯度爆炸 | 梯度范数极大 | gradient clipping（通常 1.0） |
| 不收敛 | loss 不下降 | 检查初始化、lr、数据 |

### 稳定训练技巧

```
1. 权重初始化：
   - 标准 Transformer: Xavier/He
   - GPT: 特殊缩放: std = 0.02 / √(2·layers)

2. 学习率调度：
   - Warmup: 前 2000-4000 步线性增加
   - Cosine decay 到 10% 的 peak lr

3. Gradient Clipping:
   - 全局范数裁剪: max_norm = 1.0

4. Mixed Precision:
   - BF16 训练（比 FP16 更稳定）
   - Loss scaling 防止下溢

5. 检查点：
   - 频繁保存，训练崩溃可回退
```

## 常见误区

| 误区 | 正解 |
|------|------|
| MLM 比 causal LM 更好 | ❌ 各有所长，LLM 用 causal LM 也有强大理解能力 |
| 损失越低越好 | ⚠️ 可能过拟合，需看下游任务指标 |
| Scaling Law 是精确公式 | ❌ 是经验规律，不同架构有差异 |
| 训练到 loss 不降就停 | ❌ 下游任务可能在 loss 平台后继续提升 |

## 快速检查清单

- [ ] 理解 causal LM 和 MLM 的区别
- [ ] 能解释为什么 next token prediction 能产生通用能力
- [ ] 知道 Chinchilla Scaling Law 的核心结论
- [ ] 知道至少 3 个训练稳定性技巧
