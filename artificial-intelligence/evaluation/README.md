# AI Evaluation

评估主线关注如何判断模型真的变好了，而不是 demo 看起来好了。

## 评估对象

| 对象 | 指标 |
| --- | --- |
| Base Model | perplexity、benchmark |
| Instruction Model | helpfulness、format following |
| Reasoning | math、code、logical consistency |
| Tool Use | selection、argument、success rate |
| VLM | VQA、OCR、grounding、chart understanding |
| Safety | jailbreak resistance、policy compliance |
| RAG / Agent | task success、faithfulness、latency、cost |

## 方法

- Static benchmark。
- Human eval。
- LLM-as-judge。
- Arena。
- Golden set regression。
- Red team evaluation。
- Online A/B。

## 资产

| 资产 | 状态 |
| --- | --- |
| evaluation methodology | todo |
| LLM-as-judge rubric | todo |
| VLM eval map | todo |
| agent task eval | todo |
| benchmark contamination checklist | todo |

