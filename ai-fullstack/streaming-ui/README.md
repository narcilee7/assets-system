# Streaming UI

Streaming UI 主线训练 AI 产品前端体验：增量输出、工具状态、取消、重连和事件回放。

## 核心问题

- token delta 和 structured event 如何共存？
- 工具调用状态怎么展示？
- 用户取消后后端如何停止？
- SSE 断线后如何恢复？
- 如何避免 UI 状态和后端事件不一致？

## 核心资产

| 资产 | 状态 | 关键点 |
| --- | --- | --- |
| SSE parser | todo | event、id、retry |
| agent event renderer | todo | message、tool、error |
| cancel controller | todo | AbortController、server cancel |
| reconnect state machine | todo | last-event-id、resume |
| optimistic interaction | todo | pending、rollback |

