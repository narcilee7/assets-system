# Eval

Eval 主线训练 AI 应用质量闭环：测试集、自动评估、回归和质量门禁。

## 评估对象

| 对象 | 指标 |
| --- | --- |
| RAG retrieval | recall@k、MRR、coverage |
| RAG answer | faithfulness、citation accuracy |
| Tool calling | tool selection、argument accuracy、success rate |
| Agent task | completion、step efficiency、recovery |
| Streaming UI | latency、first token、cancel success |

## 核心资产

- golden set 格式。
- judge prompt / rule-based judge。
- regression runner。
- eval report。
- CI quality gate。

