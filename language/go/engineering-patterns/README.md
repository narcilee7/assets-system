# Go Engineering Patterns

这一层训练 Go 后端工程里的常见构件。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| middleware chain | `middleware_chain/` | todo | 洋葱模型、http.Handler |
| retry with backoff | `retry_backoff/` | todo | jitter、context cancel |
| token bucket rate limiter | `rate_limiter/` | todo | time、burst、并发安全 |
| in-memory repository | `repository/` | todo | interface、mutex、错误 |
| event bus | `event_bus/` | todo | handler、同步 / 异步 |
| config loader | `config_loader/` | todo | env、默认值、校验 |
| graceful service | `graceful_service/` | todo | signal、shutdown、cleanup |

## 工程重点

- 所有阻塞操作都要考虑 context。
- 所有共享状态都要明确并发保护。
- 错误要能携带上下文，但不要吞掉根因。
- 优先用小接口表达依赖。

