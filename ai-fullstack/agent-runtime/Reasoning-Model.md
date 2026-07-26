# 模型 Reasoning 能力分层

### Layer 1：Base Model（无指令遵循，无显式推理）
- **代表**：GPT-3（davinci）、早期 LLaMA、Qwen-7B Base
- **特点**：只会续写，不会"思考"。你问 `2+3=?`，它可能直接输出 `5`，也可能输出 `= 5` 然后继续编故事
- **对 Agent 的影响**：**无法直接使用 ReAct**。因为 ReAct 要求模型严格遵循 `Thought/Action/Observation` 格式，base model 没有这个能力
- **解法**：必须 SFT（监督微调）+ RLHF，把它变成 Instruct Model

### Layer 2：Instruct Model（能遵循格式，能简单推理）
- **代表**：GPT-3.5-turbo、Claude 3 Haiku、Qwen-72B-Instruct、Llama-3-70B-Instruct
- **特点**：
  - 能遵循 System Prompt 和格式要求
  - 能做**单步推理**（CoT）：`2+3=?` → `2+3=5`
  - 能做**简单多步推理**：`24 ÷ 3 + 7` → `先算 24÷3=8，再算 8+7=15`
- **对 Agent 的影响**：**可以跑 ReAct，但质量不稳定**
  - 容易在复杂任务中"跳步"（漏掉中间思考）
  - 容易在 Observation 与预期不符时"硬编"（hallucinate 一个假的 Observation）
  - 上下文长了之后，前面的 Thought 会被后面的内容"冲掉"
- **关键指标**：**Pass@1**（一次生成的正确率）较低，**需要 Self-Consistency（多次采样投票）** 来提升

### Layer 3：Reasoning Model（原生强化推理能力）
- **代表**：OpenAI o1/o3、DeepSeek-R1、Kimi k1.5、Claude 3.5 Sonnet（在复杂任务上接近）
- **特点**：
  - 训练目标不同：不是"预测下一个 token"，而是"通过强化学习奖励长程正确推理"
  - 会自发产生**长思维链**（long CoT）：`让我想想... 首先... 但是等等，如果... 不对，我应该... 最终...`
  - 能处理**多跳推理**（multi-hop）：需要从 A 推到 B，再从 B 推到 C，中间不能断
  - 能**自我纠错**：发现前面错了，会主动回溯
- **对 Agent 的影响**：**ReAct 的 Thought 质量大幅提升**，但带来新的工程问题
  - **延迟爆炸**：o1 的 reasoning token 可能比输出 token 多 10-100 倍
  - **成本爆炸**：reasoning 过程也要计费
  - **不可控**：模型自己"想"了很久，可能想的不是你要的方向
  - **与 ReAct 的冲突**：ReAct 要求 Thought 后立即 Action，但 reasoning model 可能想 30 秒才决定 Action，Agent Loop 的 timeout 怎么设？

---

## 为什么不是所有模型都能 Reasoning？

### 1. 训练目标决定能力边界

| 训练阶段 | 目标函数 | 产生的能力 |
|---------|---------|-----------|
| **Pretrain** | 下一个 token 预测 | 语言建模、知识记忆、简单模式匹配 |
| **SFT** | 模仿人类回答 | 指令遵循、格式对齐、基础推理 |
| **RLHF** | 人类偏好奖励 | 有用、无害、风格对齐 |
| **RL + Process Reward** | 每一步推理的正确性奖励 | **长程推理、自我纠错、回溯能力** |

**关键**：只有最后一种（RL + Process Reward Model，如 DeepSeek-R1 的 GRPO）才能训练出**原生 reasoning 能力**。前面的阶段只能让模型"模仿推理"，而不是"真正推理"。

### 2. 模型规模与涌现

- **< 10B**：几乎没有可靠的多步推理能力。你强行喂 CoT Prompt，它可能背下来格式，但中间步骤经常错
- **10B ~ 70B**：开始出现**涌现能力**（emergence），但不稳定，需要 Few-shot 引导
- **> 70B / MoE**：推理能力趋于稳定，但成本太高


---

## 工程落地：模型没有 reasoning 能力怎么办？

### 策略 1：Prompt 工程补偿（低成本，效果有限）

```python
# 给 Few-shot 示例，教模型"什么叫推理"
examples = """
Q: 24 ÷ 3 + 7 = ?
A: 让我一步一步想。首先，24 除以 3 等于 8。然后，8 加 7 等于 15。所以答案是 15。

Q: {user_question}
A: 让我一步一步想。
"""
```

**局限**：模型只是**模仿格式**，不是真正理解。复杂任务还是会错。

### 策略 2：Self-Consistency（多次采样投票）

```python
# 同一个问题生成 5 次，取多数答案
answers = [llm.generate(question) for _ in range(5)]
final_answer = majority_vote(answers)
```

**效果**：对数学/逻辑题提升明显（GSM8K 上 Pass@1 从 60% → 80%）
**成本**：5 倍 Token 消耗

### 策略 3：分解器 + 验证器（外部系统补偿）

模型不会推理？那就**不让它推理**，只让它做**原子操作**：

```
用户问题: "北京今天适合穿什么？"
分解器 → 子任务1: "查北京今天天气" → 子任务2: "根据温度推荐穿衣"
模型只负责: "温度 32°C → 推荐短袖"
```

**面试点**：这就是 **Plan-and-Execute** 的核心思想——**把推理压力从模型转移到外部系统**。

### 策略 4：蒸馏小模型（DeepSeek-R1 路线）

- 用 DeepSeek-R1（671B MoE）生成高质量的 reasoning 数据
- 蒸馏到 Qwen-7B / Llama-8B 等小模型
- 小模型学会了"长思维链"的生成模式

**效果**：7B 模型在数学推理上接近 GPT-4o
**局限**：蒸馏的是**风格**，不是**能力**。超出训练分布的任务还是会崩。

---

## 对 Phus 项目的映射

| 你的设计 | 模型层面的隐含假设 | 风险 |
|---------|------------------|------|
| Agent Loop 的 `Thought` 阶段 | 假设 LLM 能生成高质量推理 | 如果接的是 GPT-3.5 或 7B 本地模型，Thought 可能是废话 |
| `△M 生成多阶段计划` | 假设 LLM 能全局规划 | 小模型的规划经常漏步骤或逻辑矛盾 |
| Verifier 重试修复 | 假设 Verifier 能判断对错 | 如果 Verifier 也是 LLM，可能"瞎验证" |

**工程建议**：
- **高价值路径**：用 DeepSeek-R1 / o1 做 Plan 和 Verifier，用 GPT-4o-mini / Qwen-72B 做 Action 执行
- **降级策略**：检测到模型输出 `Thought` 质量低（比如太短、没有逻辑连接词），自动切换到 Plan-and-Execute 模式，减少推理依赖
- **监控指标**：记录每轮 `Thought` 的 token 数、与最终结果的逻辑一致性，作为模型选型依据

---

## 面试刁难题

### 刁难 1：为什么 DeepSeek-R1 的 reasoning 能力比 GPT-4o 强？

**答**：训练目标不同。
- GPT-4o 是 RLHF 优化**人类偏好**（回答要流畅、有用、无害）
- DeepSeek-R1 是 GRPO（Group Relative Policy Optimization）优化**推理过程的正确性**，用 Process Reward Model 给每一步打分
- 结果：R1 会"想"很久、会自我纠错、会尝试多种路径；GPT-4o 倾向于快速给出一个"看起来对"的答案

### 刁难 2：你的 Provider Mesh 支持多模型，怎么根据任务选模型？

**答**：
- **规划类任务**（△M 生成计划）→ 路由到 DeepSeek-R1 / o1（需要强推理）
- **执行类任务**（工具调用、格式化输出）→ 路由到 GPT-4o-mini / Qwen-72B（快、便宜、格式遵循好）
- **验证类任务**（Verifier）→ 路由到 R1 或 Claude 3.5 Sonnet（需要判断对错）
- **兜底**：如果主模型超时，降级到更快模型，并提示用户"正在使用轻量模式"

### 刁难 3：如果客户要求跑在本地 7B 模型上，你的 Agent 怎么保证可用？

**答**：
- **降低推理期望**：不用 ReAct 的复杂 Thought，改用 Plan-and-Execute，把推理拆成外部规则
- **蒸馏微调**：用 R1 生成数据，微调本地模型学会特定任务的 CoT 格式
- **人机协同**：复杂任务自动转人工，Agent 只做它能做的原子操作
- **评估先行**：上线前用基准测试集跑 Pass@1，低于阈值的任务不接

---
