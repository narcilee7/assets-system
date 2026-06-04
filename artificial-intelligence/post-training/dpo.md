# DPO (Direct Preference Optimization)

DPO 是 RLHF 的简化替代方案。它绕过显式的 Reward Model 和 PPO，直接用偏好数据优化策略。

## 核心思想

```
RLHF 的复杂流程：
SFT → 训练 RM → PPO 优化

DPO 的简化流程：
SFT → 直接偏好优化

关键洞察：Reward Model 和最优策略之间有闭式关系
可以消去 RM，直接优化策略！
```

## 数学推导

### 从 RL 到 DPO

```
RL 目标：
max E[log π(y|x)]  s.t.  D_KL(π || π_ref) ≤ ε

最优解形式：
π*(y|x) = 1/Z(x) · π_ref(y|x) · exp(r(x,y)/β)

反解奖励：
r(x,y) = β · log(π*(y|x) / π_ref(y|x)) + β · log Z(x)
```

### DPO 损失

```
将奖励表达式代入 Bradley-Terry 偏好模型：

L_DPO = -log σ(β · log(π_θ(y_w|x)/π_ref(y_w|x))
              - β · log(π_θ(y_l|x)/π_ref(y_l|x)))

简化：
= -log σ(β · [log_ratio(y_w) - log_ratio(y_l)])

其中 log_ratio(y) = log(π_θ(y|x)) - log(π_ref(y|x))
```

**直观理解**：
- 增大 chosen 回答的相对概率（相对于参考模型）
- 降低 rejected 回答的相对概率
- β 控制偏离参考模型的程度

## DPO vs RLHF

| 维度 | DPO | RLHF (PPO) |
|------|-----|-----------|
| 需要 RM | ❌ | ✅ |
| 需要在线采样 | ❌ | ✅ |
| 需要 Value Model | ❌ | ✅ |
| 训练稳定性 | 更好 | 需调参 |
| 数据效率 | 略低（需要成对数据） | 可在线生成 |
| 超参数 | 少（主要是 β） | 多（lr, KL, clip, 等） |
| 扩展性 | 好 | 复杂 |

## DPO 的变体

### IPO (Identity Preference Optimization)

```
问题：DPO 在离线数据上可能过拟合
解决：修改损失，使用平方损失代替 log-loss

L_IPO = [log(π(y_w|x)/π(y_l|x)) - τ/2]²
```

- 更稳定的离线学习
- 避免 DPO 的极端概率

### KTO (Kahneman-Tversky Optimization)

```
问题：成对偏好数据收集成本高
解决：只需要二值反馈（好/坏），无需配对

L_KTO = λ_y · [1 - σ(β · (r(x,y) - z_ref))]

λ_y: 正负样本的平衡权重
z_ref: 期望奖励参考值
```

- 数据收集更容易
- 在大量二值反馈数据上表现好

### rDPO / Robust DPO

```
加入长度归一化和正则化
解决 DPO 容易学到的长度偏见
```

## 超参数

| 参数 | 典型值 | 影响 |
|------|--------|------|
| β | 0.1 - 0.5 | 偏离参考模型的程度，越小越激进 |
| lr | 5e-7 - 1e-6 | 比 SFT 更小，防止破坏预训练知识 |
| epoch | 1-3 | 通常 1 轮就够 |
| β 调度 | 固定或衰减 | 早期大 β（保守），后期小 β（激进） |

## 实践建议

```
1. 参考模型选择：
   - 通常用 SFT 模型作为 π_ref
   - 大模型可冻结参考模型

2. 数据质量：
   - chosen 和 rejected 的差异要明显
   - 边界模糊的样本会损害训练

3. 长度控制：
   - DPO 容易学到生成更长回答
   - 加入长度惩罚或 IPO 缓解

4. 与 SFT 混合：
   - 有些实现同时保留 SFT loss
   - L = L_DPO + λ · L_SFT
```

## 常见误区

| 误区 | 正解 |
|------|------|
| DPO 总是比 PPO 好 | ⚠️ 大部分场景更简单有效，但某些复杂任务 PPO 上限更高 |
| DPO 不需要参考模型 | ❌ 需要 π_ref，通常就是 SFT 模型 |
| DPO 训练更快 | ✅ 是，因为不需要在线采样和 Value Model |
| β 越小越好 | ❌ 太小会导致过拟合和模式崩溃 |

## 快速检查清单

- [ ] 理解 DPO 的核心洞察（消去 RM）
- [ ] 能写出 DPO 的损失函数
- [ ] 知道 DPO 和 PPO 的主要差异
- [ ] 了解 IPO 和 KTO 解决的问题
