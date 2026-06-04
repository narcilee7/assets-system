# 监督微调 (SFT)

SFT 是将预训练好的基础模型变成能遵循指令的助手的核心步骤。它让模型学会"如何回答"，而非"知道什么"。

## SFT 的本质

```
预训练：next token prediction on raw text
        → 学会语言和世界知识

SFT：next token prediction on (instruction, response) pairs
      → 学会对话格式、指令遵循、 helpfulness
```

## 数据格式

### 标准对话格式

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the capital of France?"},
    {"role": "assistant", "content": "The capital of France is Paris."},
    {"role": "user", "content": "What is its population?"},
    {"role": "assistant", "content": "Paris has a population of about 2.1 million..."}
  ]
}
```

### 关键设计决策

| 决策 | 选项 | 影响 |
|------|------|------|
| System Prompt | 固定 vs 多样化 | 固定简化，多样化增强鲁棒性 |
| 多轮 vs 单轮 | 混合比例 | 多轮训练对话能力 |
| 回答风格 | 详细 vs 简洁 | 影响用户体验 |
| 拒绝策略 | 直接拒绝 vs 解释原因 | 安全性和 helpfulness 平衡 |

## 损失计算

### 仅计算 Assistant 的 Loss

```
输入: <|system|>You are helpful<|user|>Hi<|assistant|>Hello!
       [MASK]  [MASK]  [MASK]  [MASK]    [计算]   [计算]

不计算 system 和 user 部分的 loss，只优化 assistant 的回复
```

**为什么？**
- 用户输入不是模型"生成"的，不需要优化
- 让模型专注于学习"如何回答"

### 多轮对话的 Loss 掩码

```
每一轮 assistant 的输出都要计算 loss：

<|user|>Q1<|assistant|>A1<|user|>Q2<|assistant|>A2
[MASK]  [MASK]  [计算]  [计算]  [MASK]  [计算]  [计算]
```

## 数据质量

### 质量 > 数量

```
发现：
- 1K 高质量 > 10K 低质量
- 但 10K 高质量 + 10K 中等质量 > 只有 10K 高质量

高质量标准：
- 准确：事实正确
- 完整：回答全面
- 清晰：逻辑清晰、格式规范
- 安全：无有害内容
```

### 数据多样性

| 维度 | 多样性要求 |
|------|-----------|
| 任务类型 | QA、摘要、翻译、代码、推理、创作 |
| 领域 | 科学、人文、技术、日常生活 |
| 语言 | 多语言覆盖 |
| 难度 | 简单、中等、困难混合 |
| 长度 | 短、中、长回答 |

## 训练技巧

### 学习率

```
SFT 学习率通常比预训练小 10-100 倍：
- 预训练: 1e-4 ~ 3e-4
- SFT: 1e-5 ~ 2e-5

原因：不要破坏预训练学到的知识
```

### Epoch 数

```
通常 1-3 个 epoch：
- 太多 → 过拟合训练数据分布
- 太少 → 没学充分

大模型（70B+）通常 1 epoch 就够了
```

### 批次大小

```
较大的 batch size（如 128-1024）通常更好：
- 梯度更稳定
- 但受显存限制

梯度累积：小显存模拟大 batch
```

### Packing

```
将多个短样本拼接成一个长序列：
- 提高 GPU 利用率
- 需要特殊 attention mask 防止跨样本 attention

<|user|>Q1<|assistant|>A1<|end|><|user|>Q2<|assistant|>A2<|end|>
```

## SFT 的局限

```
1. 分布偏移：训练数据分布 ≠ 真实用户分布
2. 对齐税：SFT 可能轻微降低某些基础能力
3. 主观性："好回答"是主观的，难以统一
4. 长度偏见：模型倾向于生成和训练数据类似长度的回答
```

## 常见误区

| 误区 | 正解 |
|------|------|
| SFT 数据越多越好 | ❌ 质量比数量重要，过多会过拟合 |
| SFT 能解决所有问题 | ❌ 只能学格式和风格，安全/偏好需要 RLHF |
| 所有 token 都要计算 loss | ❌ 只算 assistant 的 loss |
| 长回答比短回答好 | ❌ 取决于场景，简洁往往更受欢迎 |

## 快速检查清单

- [ ] 理解 SFT 和预训练的核心区别
- [ ] 知道 loss mask 的设计原则
- [ ] 理解高质量 SFT 数据的标准
- [ ] 知道 SFT 的典型超参数范围
