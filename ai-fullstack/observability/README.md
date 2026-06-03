# AI Observability

AI 可观测性主线训练 prompt、completion、tool call、token、latency 和 eval 的统一追踪。

## Trace Span

| Span | 字段 |
| --- | --- |
| model_call | model、tokens、latency、cost |
| tool_call | tool、args hash、status、latency |
| retrieval | query、top_k、doc ids、scores |
| planner | plan、step count、confidence |
| eval | case id、score、judge |

