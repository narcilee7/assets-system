# Softmax 与 Temperature

Softmax 是分类问题的标准输出层，Temperature 是控制模型输出分布"锐度"的核心超参数。

## Softmax 函数

```
softmax(z_i) = exp(z_i) / Σ_j exp(z_j)
```

### 性质

| 性质 | 说明 |
|------|------|
| 归一化 | 输出之和为 1，形成概率分布 |
| 保序 | 不改变输入的相对大小顺序 |
| 放大差异 | 大的 logit 获得不成比例的概率 |

### 数值稳定性

```python
def stable_softmax(z):
    z_max = max(z)
    exps = np.exp(z - z_max)
    return exps / np.sum(exps)
```

减去 max 防止指数爆炸。

## Temperature

```
softmax(z_i / T) = exp(z_i / T) / Σ_j exp(z_j / T)
```

| Temperature | 效果 | 场景 |
|-------------|------|------|
| T → 0 | 趋近于 one-hot（确定性） | greedy decoding |
| T = 1 | 标准 softmax | 默认采样 |
| T → ∞ | 趋近于均匀分布（最随机） | 探索、创意生成 |

**核心直觉**：Temperature 缩放 logit 的"差距"。T < 1 放大差距（更自信），T > 1 缩小差距（更保守）。

## AI 中的应用

| 场景 | Temperature 设置 | 原因 |
|------|-----------------|------|
| 代码生成 | 0.1 - 0.3 | 需要确定性，减少语法错误 |
| 对话/创意写作 | 0.7 - 1.0 | 平衡流畅度和多样性 |
| 头脑风暴 | 1.0 - 1.5 | 需要更多创意和意外性 |
| 分类/推理 | 趋近于 0 | 需要最可能的答案 |

## Top-k 与 Top-p (Nucleus) 采样

### Top-k

- 只从概率最高的 k 个 token 中采样
- k=1 即 greedy decoding
- 简单但不够灵活：不同分布的"有效候选数"不同

### Top-p (Nucleus Sampling)

- 从高到低累积概率，取最小集合使累积概率 ≥ p
- 更自适应：分布平坦时选得多，尖锐时选得少

**实际配置**：通常 `temperature=0.7, top_p=0.9`，或 `temperature=0.1` 做确定性生成。

## 常见误区

| 误区 | 正解 |
|------|------|
| Temperature 控制"智能程度" | ❌ 控制的是随机性，不是能力 |
| T=0 和 greedy 等价 | ⚠️ 极限等价，但实现上 T=0 可能数值问题，常用 argmax |
| Top-p 越小越好 | ❌ 太小多样性差，太大可能采样到噪声 |

## 快速检查清单

- [ ] 理解 Temperature 对分布形状的影响
- [ ] 知道不同任务推荐的 Temperature 范围
- [ ] 理解 Top-k 和 Top-p 的区别和适用场景
