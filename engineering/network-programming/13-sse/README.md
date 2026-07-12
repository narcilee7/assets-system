# 13 SSE（Server-Sent Events）

## 问题描述

实现一个 **SSE（Server-Sent Events）服务器和客户端**：
- 服务器通过 HTTP 长连接持续向客户端推送文本事件。
- 事件格式遵循 W3C 规范：`data: <payload>\n\n`。
- 支持 **Last-Event-ID**：客户端重连时携带上次接收的 ID，服务器从该 ID 之后恢复推送。
- 支持 **心跳**：服务器定期发送注释行（`:heartbeat\n`）保持连接活跃。

## 核心概念

- **HTTP 长连接**：SSE 基于 HTTP/1.1 的 `Transfer-Encoding: chunked` 或保持连接打开持续写数据。
- **事件流**：每条事件以 `data:` 开头，以两个换行符结束。可以包含 `id:`、`event:`、`retry:` 字段。
- **断线恢复**：`Last-Event-ID` 让客户端在断线后从上次位置继续，不丢失消息。

## 约束

- 不得使用现成的 SSE 库（如 Python 的 `sseclient`、Node.js 的 `eventsource`）。
- 服务器和客户端都必须基于原始 HTTP socket 实现。

## 手写提示

1. SSE 响应的 Content-Type 应该是什么？（`text/event-stream`）
2. 如何保持 HTTP 连接不断开？（不发送 Content-Length，也不关闭连接）
3. 客户端如何检测连接断开？（read 超时、EOF、或长时间无心跳）
4. Last-Event-ID 在请求头中如何传递？（`Last-Event-ID: <id>`）

## 验证方式

```bash
make run
```

验证逻辑：客户端连接 SSE 服务器，接收若干事件，模拟断线后使用 Last-Event-ID 重连，验证恢复正确。
