# Tool Calling

Tool Calling 主线训练工具 schema、参数校验、权限、执行、失败恢复和结构化结果。

## 核心问题

- schema 怎么设计才能让模型稳定调用？
- 工具参数如何校验和修复？
- 有副作用工具如何确认和幂等？
- 工具失败时让模型重试还是系统重试？
- tool result 如何进入上下文？

## 核心资产

| 资产 | 状态 | 关键点 |
| --- | --- | --- |
| tool registry | todo | name、schema、handler、permission |
| schema validator | todo | parse、validate、repair |
| idempotent tool call | todo | call id、dedupe、side effect |
| tool error taxonomy | todo | retryable、fatal、needs_user |
| tool result normalizer | todo | structured output |

