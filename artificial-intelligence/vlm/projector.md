# Projector / Adapter

Projector 是 VLM 中连接视觉编码器和语言模型的"桥梁"。它将视觉特征映射到语言模型的嵌入空间。

## 为什么需要 Projector？

```
Vision Encoder 输出: 视觉特征空间 (CLIP space)
LLM 输入:            语言嵌入空间 (GPT space)

问题：这两个空间不对齐！
解决：学一个映射函数 (Projector)
```

## 主流 Projector 设计

### Linear Projector

```
V_visual = W · V_image + b

最简单，只有一个线性层
```

- LLaVA 早期使用
- 参数量小，训练快
- 表达能力有限

### MLP Projector

```
V_visual = MLP(V_image)
通常: Linear → GELU → Linear
```

- 非线性映射能力更强
- LLaVA-1.5、Qwen-VL 使用

### Q-Former (BLIP-2)

```
可学习的 Query Tokens (如 32 个)
  → Cross-Attention with Image Features
  → 输出压缩的视觉表示
```

- 将大量 patch tokens（196+）压缩为少量 query tokens（32）
- 显著减少视觉 token 数量
- BLIP-2、InstructBLIP 使用

### Perceiver Resampler (Flamingo)

```
类似 Q-Former，但用更深的 Transformer
可学习的 latent tokens
  → 多层 Cross-Attention
  → 深层压缩表示
```

### C-Abstractor / MLP 混合

```
MiniGPT-4, LLaVA-Next: 更复杂的 projector
可能包含卷积下采样 + MLP
```

## Projector 对比

| 设计 | 压缩率 | 表达能力 | 训练难度 | 代表 |
|------|--------|---------|---------|------|
| Linear | 1× | 低 | 易 | 早期 LLaVA |
| MLP | 1× | 中 | 易 | LLaVA-1.5 |
| Q-Former | 32/256 ≈ 1/8 | 高 | 中 | BLIP-2 |
| Perceiver | 可配置 | 高 | 中 | Flamingo |

## 训练策略

### 两阶段训练

```
Stage 1: 对齐预训练
  - 冻结 Vision Encoder 和 LLM
  - 只训练 Projector
  - 数据：大规模图文对（如 LAION、CC12M）
  - 目标：让视觉特征能被 LLM 理解

Stage 2: 指令微调
  - 冻结 Vision Encoder
  - 训练 Projector + LLM（或全训练）
  - 数据：多模态指令数据（如 LLaVA-Instruct）
  - 目标：学会遵循指令
```

### 关键超参数

| 参数 | 选择 | 影响 |
|------|------|------|
| Projector 层数 | 1-3 层 | 表达能力 vs 过拟合 |
| 视觉 token 数 | 256-576 | 分辨率 vs 计算 |
| 学习率 | 1e-3 ~ 2e-4 | 通常比 LLM 大 |

## 视觉 Token 数量与成本

```
以 LLaVA 为例：
- 图像 336×336, patch 14×14 → 576 视觉 tokens
- 文本 prompt: 50 tokens
- 总输入: 626 tokens
- 视觉部分占 92%！

Q-Former 压缩到 32 tokens:
- 总输入: 82 tokens
- 显著降低计算成本
```

## 常见误区

| 误区 | 正解 |
|------|------|
| Projector 越复杂越好 | ❌ 简单 MLP 在多数场景足够 |
| 视觉 token 越多越好 | ⚠️ 是，但成本线性增长 |
| Stage 1 可以跳过 | ❌ 不预训练对齐，直接 SFT 效果差 |
| 冻结 LLM 比微调好 | ⚠️ 小模型需微调，大模型可冻结 |

## 快速检查清单

- [ ] 理解 Projector 的核心作用（空间对齐）
- [ ] 知道 Linear/MLP/Q-Former 的 tradeoff
- [ ] 理解两阶段训练的目的
- [ ] 能估算视觉 token 对总计算量的影响
