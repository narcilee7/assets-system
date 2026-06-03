# Workflow Orchestration

工作流主线训练多步骤 AI 任务的编排、重试、恢复和人工审批。

## 核心构件

| 构件 | 关键点 |
| --- | --- |
| Step | input、output、status |
| DAG | dependency、parallelism |
| Retry | retry policy、backoff |
| Resume | checkpoint、idempotency |
| Approval | human gate、audit |

