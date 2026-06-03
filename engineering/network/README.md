# Network Engineering

网络工程层训练 HTTP 客户端、重试、取消、超时、幂等、上传下载和流式传输。

## 核心构件

| 构件 | 状态 | 关键点 |
| --- | --- | --- |
| request client | draft | baseURL、headers、interceptor |
| retry with backoff | todo | jitter、幂等、错误分类 |
| timeout / cancellation | todo | AbortController、context |
| upload chunks | draft | 分片、进度、秒传、断点续传 |
| SSE client | todo | reconnect、heartbeat、event parsing |
| WebSocket client | todo | reconnect、ack、backpressure |

## 设计原则

- 默认所有网络请求都可能失败。
- 重试必须考虑幂等。
- 超时、取消、重试要能组合。
- 流式协议要考虑断线恢复和状态同步。

