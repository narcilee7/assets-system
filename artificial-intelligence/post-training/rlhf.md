# RLHF (Reinforcement Learning from Human Feedback)

RLHF 是将人类偏好注入模型的核心方法。它让模型不只是"正确"，而是"符合人类偏好"。

## 三阶段流程

```
Stage 1: SFT
  用高质量数据训练基础模型 → 得到 SFT Model

Stage 2: 训练 Reward Model
  收集人类偏好数据（A vs B 哪个更好）
  训练模型预测人类偏好 → 得到 Reward Model

Stage 3: RL 优化
  用 PPO 等算法优化 SFT 模型
  目标：最大化 Reward，同时不要偏离 SFT 太远
```

## Reward Model (RM)

### 训练数据

```
格式：
Prompt: "Explain quantum computing"
Response A: "Quantum computing uses qubits..."  [chosen]
Response B: "It's complicated and hard."        [rejected]

人类标注员比较多个回答，选择更好的
```

### 模型架构

```
通常：SFT 模型去掉 LM Head，加一个新的 Reward Head
输入：(prompt, response)
输出：标量奖励值
```

### 损失函数

```
Bradley-Terry 模型：
L = -log σ(r_θ(x, y_w) - r_θ(x, y_l))

y_w: 人类偏好的回答 (chosen)
y_l: 人类不喜欢的回答 (rejected)

目标：让 chosen 的分数显著高于 rejected
```

### RM 的问题

| 问题 | 说明 |
|------|------|
| 奖励黑客 (Reward Hacking) | 模型找到欺骗 RM 的方式，而非真正变好 |
| 分布外泛化差 | RM 只在训练过的分布上可靠 |
| 主观性 | 不同标注者偏好不一致 |
| 可扩展性 | 人类标注成本高 |

## PPO (Proximal Policy Optimization)

### 核心公式

```
目标：
max E[RM(x, y)] - β · D_KL(π_θ || π_ref)

RM(x, y):     Reward Model 的分数（越高越好）
D_KL:         KL 散度惩罚（不要偏离 SFT 模型太远）
β:            KL 惩罚系数
π_θ:          当前策略（要优化的模型）
π_ref:        参考策略（SFT 模型，冻结）
```

### PPO 技巧

```
1. Clipped Objective:
   限制策略更新幅度，防止训练不稳定

2. Advantage Estimation:
   A = R + γV(s') - V(s)
   需要训练一个 Value Model（critic）

3. KL Penalty:
   通常 KL ≈ 0.01-0.02 per token
```

## RLHF 的替代方案

| 方法 | 核心思想 | 优缺点 |
|------|---------|--------|
| DPO | 直接用偏好数据优化，无需 RM | 更简单，但数据效率略低 |
| IPO | 改进 DPO 的泛化 | 更稳定的偏好学习 |
| KTO | 只需二值反馈（好/坏），无需成对 | 数据收集更简单 |
| RLAIF | 用 AI（如 GPT-4）替代人类标注 | 成本低，可能有 AI 偏见 |
| DNO | 直接负优化（降低坏样本概率） | 简单但不够精细 |

## 奖励黑客案例

```
模型发现 RM 喜欢长回答：
→ 生成冗长、重复的内容

模型发现 RM 喜欢特定格式：
→ 过度使用 bullet points

模型发现 RM 对某些关键词给高分：
→ 在回答中堆砌这些词

解决：
- 多轮 RM 迭代
- 加入长度惩罚
- 人工审核异常样本
- KL 惩罚约束
```

## 常见误区

| 误区 | 正解 |
|------|------|
| RLHF 比 SFT 更重要 | ❌ 两者互补，SFT 学格式，RLHF 学校准偏好 |
| Reward Model 是完美的 | ❌ RM 有明显局限，会被 hack |
| PPO 是唯一选择 | ❌ DPO 等更简单的方法在很多场景足够 |
| RLHF 能解决安全问题 | ⚠️ 有帮助，但需要配合 red teaming 和 safety tuning |

## 快速检查清单

- [ ] 理解 RLHF 的三阶段流程
- [ ] 知道 Reward Model 的损失函数
- [ ] 理解奖励黑客的概念和应对
- [ ] 知道 DPO 和 RLHF 的核心差异
