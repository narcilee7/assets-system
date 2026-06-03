# Agent Platform

## 目标

这是 AI 全栈系统设计核心案例：从用户请求到 Agent 规划、工具调用、权限控制、流式输出、记忆和评估。

## 核心模块

| 模块 | 关键问题 |
| --- | --- |
| Session | 上下文、历史、状态恢复 |
| Planner | 任务拆解、约束、可解释性 |
| Tool Runtime | schema、权限、超时、重试、审计 |
| Memory | 短期 / 长期、检索、遗忘 |
| Streaming | 事件协议、SSE、取消、恢复 |
| Eval | golden set、judge、回归 |
| Safety | 高风险动作确认、数据边界 |

## 面试追问

- 工具调用失败如何恢复？
- 如何避免重复执行有副作用工具？
- 如何做 streaming event schema？
- 如何做 Agent 质量回归？
- 如何隔离用户数据和工具权限？

