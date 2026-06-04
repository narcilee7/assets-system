# 深度学习优化器详解

优化器决定模型如何更新参数。从 SGD 到 AdamW，不同优化器在收敛速度、泛化能力和内存开销上有显著差异。

## 优化器对比

| 优化器 | 动量 | 自适应学习率 | 内存/参数 | 推荐场景 |
|--------|------|------------|----------|---------|
| SGD | ❌ | ❌ | 1× | 大规模 CV，追求最佳泛化 |
| SGD+Momentum | ✅ | ❌ | 1× | 大多数 CV 任务 |
| AdaGrad | ❌ | ✅ | 1× | 稀疏梯度（NLP 早期） |
| RMSprop | ❌ | ✅ | 1× | RNN、非稳态目标 |
| Adam | ✅ | ✅ | 2× | 通用默认选择 |
| AdamW | ✅ | ✅ | 2× | **Transformer / 大模型默认** |
| AdamW-8bit | ✅ | ✅ | ~1× | 显存受限场景 |
| Lion | ✅ | ❌ | 1× | 大模型训练，内存友好 |

## Adam 深入

```python
# PyTorch Adam (简化)
m = beta1 * m + (1 - beta1) * g        # 一阶矩
v = beta2 * v + (1 - beta2) * g**2     # 二阶矩
m_hat = m / (1 - beta1**t)              # 偏差修正
v_hat = v / (1 - beta2**t)
update = lr * m_hat / (sqrt(v_hat) + eps)
```

### 偏差修正的必要性

- 初始时 m, v 都初始化为 0
- 前几次更新被低估（比如 t=1 时 m_hat = g，但如果不修正只有 0.1g）
- 修正后：`m_hat = m / (1-β^t)`，初期放大，后期趋近 1

### 超参数选择

| 参数 | 默认值 | 调整建议 |
|------|--------|---------|
| lr | 1e-3 | 预训练 1e-4 ~ 3e-4，微调 1e-5 ~ 1e-4 |
| β1 | 0.9 | 通常不动 |
| β2 | 0.999 | 长序列可提高到 0.98（减少早期权重） |
| eps | 1e-8 | 混合精度训练建议 1e-4 |

## AdamW 详解

### Adam + L2 vs AdamW

```python
# Adam + L2 (WRONG)
g_eff = g + weight_decay * θ
# L2 正则通过梯度影响，但自适应学习率会抵消它

# AdamW (CORRECT)
θ = θ - lr * (m_hat / sqrt(v_hat) + weight_decay * θ)
# 权重衰减与梯度更新解耦
```

**实验证据**：AdamW 在 ImageNet、GLUE、各种大模型上显著优于 Adam+L2。

## Lion 优化器

```python
# Lion: EVOlved Sign Momentum
# 只用一阶矩的符号，不存二阶矩
c = beta1 * m + (1 - beta1) * g
θ = θ - lr * sign(c)
m = beta2 * m + (1 - beta2) * g
```

| 优点 | 缺点 |
|------|------|
| 内存减半（无 v） | 对超参数更敏感 |
| 大 batch 下收敛快 | 小数据可能不稳定 |
| 权重更新更稀疏 | 需要更大的 batch |

## 学习率调度策略

```python
# Warmup + Cosine Decay (大模型标配)
if step < warmup_steps:
    lr = base_lr * step / warmup_steps
else:
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    lr = base_lr * 0.5 * (1 + cos(pi * progress))
```

| 调度器 | 特点 | 场景 |
|--------|------|------|
| Step Decay | 每 N epoch × 0.1 | ResNet 等 CV 模型 |
| Cosine | 平滑衰减到 0 | Transformer 预训练 |
| Warmup | 线性增加到目标 | 防止早期梯度爆炸 |
| ReduceLROnPlateau | 验证集不降则减 | 微调 |
| OneCycle | 先升后降 | 快速收敛实验 |

## 常见误区

| 误区 | 正解 |
|------|------|
| Adam 总是最好的 | ❌ SGD+Momentum 泛化通常更好，Adam 收敛更快 |
| 所有层用相同 lr | ❌ Embedding 层通常需要更大 lr |
| eps 可以忽略 | ❌ 混合精度下小 eps 导致除零/NaN |
| 学习率调度不重要 | ❌ Cosine 比 Step 在大模型上能提几个点 |

## 快速检查清单

- [ ] 理解 Adam 中 m 和 v 的物理意义
- [ ] 知道 AdamW 和 Adam+L2 的实现差异
- [ ] 能画出 Warmup + Cosine 的学习率曲线
- [ ] 知道不同任务的典型 lr 范围
