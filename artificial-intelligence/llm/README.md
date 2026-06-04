# LLM

LLM 主线用于理解大语言模型的结构、训练、能力边界和工程影响。

## 系统地图

| 模块 | 关键点 |
| --- | --- |
| Tokenizer | BPE、SentencePiece、vocab、special token |
| Model Architecture | decoder-only、MoE、context length |
| Pretraining | next token prediction、data mixture、scaling |
| Post-training | SFT、RLHF、DPO、tool use |
| Context | attention、position、long context、compression |
| Capability | instruction following、reasoning、coding、tool calling |
| Limitation | hallucination、recency、bias、context loss |

## 资产

| 资产 | 状态 |
| --- | --- |
| [Tokenizer 详解](./tokenizer.md) | ✅ |
| [LLM 架构详解](./architecture.md) | ✅ |
| [长上下文技术](./long-context.md) | ✅ |
| [幻觉问题](./hallucination.md) | ✅ |

## 追问

- 为什么主流 LLM 多是 decoder-only？
- MoE 的收益和工程代价是什么？
- 长上下文为什么不等于有效记忆？
- 模型幻觉来自哪里？
