# Research Papers

论文主线用于建立模型研究的阅读路径。

## 精读模板

```text
问题是什么？
已有方法缺什么？
核心方法是什么？
训练 / 数据 / 模型结构有什么变化？
实验如何证明有效？
局限是什么？
工程上如何迁移？
和其他论文的关系是什么？
```

## 经典论文路线

### Transformer 基础

| 论文 | 贡献 |
|------|------|
| Attention Is All You Need (2017) | Transformer 架构 |
| BERT (2018) | 双向预训练 |
| GPT-2 / GPT-3 (2019/2020) | 规模化语言建模 |
| T5 (2019) | Encoder-Decoder 统一框架 |
| Scaling Laws (2020) | 规模法则 |

### LLM 训练

| 论文 | 贡献 |
|------|------|
| LLaMA (2023) | 开源高效预训练 |
| Chinchilla (2022) | 最优数据-参数比例 |
| InstructGPT (2022) | RLHF 三阶段 |
| LLaMA-2 (2023) | GQA、长上下文、安全 |
| DPO (2023) | 直接偏好优化 |

### 推理优化

| 论文 | 贡献 |
|------|------|
| FlashAttention (2022) | IO-aware attention |
| PagedAttention / vLLM (2023) | 分页 KV Cache |
| Speculative Decoding (2022) | 无损加速 |
| GPTQ (2022) | 训练后量化 |
| AWQ (2023) | 激活感知量化 |

### VLM / 多模态

| 论文 | 贡献 |
|------|------|
| CLIP (2021) | 图文对比学习 |
| BLIP-2 (2023) | Q-Former 桥接 |
| LLaVA (2023) | 简单高效的 VLM |
| Flamingo (2022) | 少样本多模态学习 |

### 推理与 Agent

| 论文 | 贡献 |
|------|------|
| Chain-of-Thought (2022) | 思维链推理 |
| ReAct (2022) | 推理+行动结合 |
| Toolformer (2023) | 自监督工具学习 |
| o1 (2024) | 长思维链 + RL 训练 |

## 资产

| 资产 | 状态 |
| --- | --- |
| transformer-papers reading notes | todo |
| alignment-papers reading notes | todo |
| inference-papers reading notes | todo |
