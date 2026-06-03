# Agent Runtime

Agent Runtime 是 AI 全栈主线的核心资产。它负责把用户意图转成可执行计划，并通过工具、模型和事件流完成任务。

## 第一版范围

| 模块 | 能力 |
| --- | --- |
| Session | 保存一次任务的上下文和事件 |
| Planner | 生成简单步骤计划 |
| Tool Registry | 注册工具、schema 和权限 |
| Executor | 执行步骤，处理工具结果 |
| Event Stream | 输出 plan、tool_start、tool_result、message、error |
| Human Gate | 高风险工具执行前确认 |

## 事件协议草案

```text
session_started
plan_created
step_started
tool_call_started
tool_call_completed
tool_call_failed
message_delta
requires_confirmation
session_completed
session_failed
```

## 失败路径

- planner 生成不可执行步骤。
- 工具参数校验失败。
- 工具超时。
- 工具有副作用但结果未知。
- 用户取消。
- 模型输出和工具结果冲突。

## 追问

- 如何避免重复执行支付、发送消息等副作用工具？
- 如何让 Agent 可以恢复中断任务？
- 如何记录可回放 trace？
- 哪些工具必须 human-in-the-loop？

