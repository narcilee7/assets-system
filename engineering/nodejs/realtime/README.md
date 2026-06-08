# Node.js Realtime

## 主线

| 技术 | 适合 |
| --- | --- |
| SSE | AI streaming、单向事件 |
| WebSocket | 双向实时通信 |
| Socket.IO | 房间、自动重连、兼容性 |
| Redis PubSub | 多实例广播 |

## 核心问题

- 连接状态如何保存？
- 多实例如何广播？
- 慢客户端如何处理？
- 断线如何恢复？
- 如何做鉴权和限流？

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| SSE server with resume | `sse-server/` | EventSource、Last-Event-ID 续传、心跳 |
| WebSocket room service | `websocket-room/` | Room 管理、连接状态、多实例 Redis Adapter |
| Agent event streaming gateway | *(见 `../ai-backend/streaming-gateway`)* | AI SSE Streaming + Tool Call |
