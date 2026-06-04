# API

## 协议选择

### HTTP API（用于管理面和控制面）

### WebSocket API（用于数据面实时通信）

### SSE API（用于单向流推送场景）

---

## 1. 连接建立

### WebSocket 连接建立

#### 握手请求

```http
GET /ws/v1/realtime/connect
Host: realtime.example.com
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
X-Request-ID: {device_id}
X-User-ID: {user_id}
X-Auth-Token: {jwt}
```

#### 握手响应（成功）

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
X-Session-ID: sess-01HV3WWZP1A3B5C6D7E8F9G0H
```

#### 握手响应（失败）

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "unauthorized",
  "error_description": "Token expired"
}
```

---

### SSE 连接建立

```http
GET /sse/v1/realtime/stream?topics=order_updates,announcements
Host: realtime.example.com
Accept: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-User-ID: {user_id}
X-Auth-Token: {jwt}
```

响应流格式：

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Session-ID: sess-01HV3WWZP1A3B5C6D7E8F9G0H
Transfer-Encoding: chunked

id: 1704067200001
event: message
data: {"type": "message", "topic": "order_updates", "payload": {"order_id": "o123", "status": "paid"}}

id: 1704067200002
event: heartbeat
data: {"type": "heartbeat", "ts": 1704067200002}

id: 1704067200003
event: message
data: {"type": "message", "topic": "announcements", "payload": {"title": "系统维护通知"}}
```

---

## 2. 消息格式

### WebSocket 帧格式

```
Opcode:
  0x0 = 继续帧（Continuation）
  0x1 = 文本帧（Text）
  0x2 = 二进制帧（Binary）
  0x8 = 关闭帧（Close）
  0x9 = Ping
  0xA = Pong
```

### 文本消息 JSON 格式

```json
{
  "mid": "msg-01HV3WWZP1A3B5C6D7E8F9G0H",
  "type": "message",
  "from": "user-001",
  "to": "room-001",
  "topic": "order_updates",
  "payload": {
    "order_id": "o123",
    "status": "paid",
    "amount": 9900
  },
  "ts": 1704067200001,
  "seq": 1234
}
```

### 消息类型分类

| type | 说明 | 方向 |
|------|------|------|
| `message` | 普通业务消息 | 双向 |
| `ack` | 消息确认（已收到） | 客户端→服务端 |
| `heartbeat` | 心跳 Ping/Pong | 双向 |
| `subscribe` | 订阅主题/房间 | 客户端→服务端 |
| `unsubscribe` | 取消订阅 | 客户端→服务端 |
| `typing` | 正在输入状态 | 双向 |
| `presence` | 用户在线状态变更 | 服务端→客户端 |
| `system` | 系统通知（连接成功/断开等） | 服务端→客户端 |
| `error` | 错误消息 | 服务端→客户端 |
| `stream_start` | 流式输出开始 | 服务端→客户端 |
| `stream_data` | 流式输出数据片 | 服务端→客户端 |
| `stream_end` | 流式输出结束 | 服务端→客户端 |

---

## 3. 房间 / 主题管理

### 订阅房间

```json
{
  "mid": "msg-xxx",
  "type": "subscribe",
  "room_id": "room-001",
  "metadata": {
    "join_time": 1704067200001
  }
}
```

### 订阅主题

```json
{
  "mid": "msg-xxx",
  "type": "subscribe",
  "topics": ["order_updates", "announcements"]
}
```

### 取消订阅

```json
{
  "mid": "msg-xxx",
  "type": "unsubscribe",
  "room_id": "room-001"
}
```

---

## 4. 消息发送

### 发送房间消息

```json
{
  "mid": "msg-01HV3WWZP1A3B5C6D7E8F9G0H",
  "type": "message",
  "from": "user-001",
  "to": "room-001",
  "payload": {
    "content": "大家好",
    "reply_to": "msg-original-001"
  }
}
```

### 发送点对点消息

```json
{
  "mid": "msg-01HV3WWZP1A3B5C6D7E8F9G0H",
  "type": "message",
  "from": "user-001",
  "to_user": "user-002",
  "payload": {
    "content": "私下跟你说"
  }
}
```

### 消息 ACK（客户端回确认）

```json
{
  "mid": "msg-01HV3WWZP1A3B5C6D7E8F9G0H",
  "type": "ack",
  "acked_mid": "msg-01HV3WWZP1A3B5C6D7E8F9G0H",
  "ts": 1704067200100
}
```

### 流式输出（Agent 场景）

```json
// 开始
{
  "mid": "msg-stream-001",
  "type": "stream_start",
  "stream_id": "stream-abc123",
  "metadata": {
    "model": "gpt-4",
    "task_id": "task-xyz"
  }
}

// 数据片
{
  "mid": "msg-stream-001",
  "type": "stream_data",
  "stream_id": "stream-abc123",
  "seq": 1,
  "content": "今天",
  "done": false
}

// 更多数据片
{
  "type": "stream_data",
  "stream_id": "stream-abc123",
  "seq": 2,
  "content": "天气",
  "done": false
}

// 结束
{
  "mid": "msg-stream-001",
  "type": "stream_end",
  "stream_id": "stream-abc123",
  "content": "今天天气很好",
  "done": true,
  "usage": {
    "tokens": 123,
    "latency_ms": 2345
  }
}
```

---

## 5. 心跳协议

### 服务端 Ping

```json
{
  "mid": "msg-ping-001",
  "type": "heartbeat",
  "direction": "ping",
  "ts": 1704067200001
}
```

### 客户端 Pong

```json
{
  "mid": "msg-ping-001",
  "type": "heartbeat",
  "direction": "pong",
  "ts": 1704067200002,
  "latency_ms": 12
}
```

### 心跳策略

```
心跳间隔：15s（检测连接存活）
心跳超时：45s（连续 3 次 Ping 无响应则判定断连）
WebSocket Ping/Pong 帧（0x9/0xA）：可穿透中间设备，优先使用
SSE 心跳：用 event: heartbeat 消息，客户端需要在超时间内收到消息
```

---

## 6. 连接状态通知

### 用户上线

```json
{
  "type": "presence",
  "event": "online",
  "user_id": "user-001",
  "device_id": "device-abc",
  "ts": 1704067200001
}
```

### 用户下线

```json
{
  "type": "presence",
  "event": "offline",
  "user_id": "user-001",
  "device_id": "device-abc",
  "reason": "disconnect",
  "ts": 1704067200001
}
```

### 正在输入

```json
{
  "type": "typing",
  "room_id": "room-001",
  "user_id": "user-001",
  "ts": 1704067200001
}
```

---

## 7. 错误码

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| `1001` | 连接关闭（正常） | 客户端收到后不再重发 |
| `1002` | 协议错误 | 客户端需要重新建立连接 |
| `1006` | 连接异常断开（网络问题） | 触发自动重连 |
| `1009` | 消息过大 | 拆分成小消息重发 |
| `1011` | 服务端内部错误 | 客户端等待后重连 |
| `4001` | Token 无效 | 重新登录获取 Token |
| `4002` | 连接数超限 | 客户端稍后重试 |
| `4003` | 用户被踢出 | 提示用户账号异常 |
| `4004` | 房间不存在 | 检查 room_id |
| `4005` | 无权加入房间 | 检查用户权限 |

---

## 8. 重连与消息补发

### 客户端重连流程

```
连接断开
  │
  ▼
等待 1s（避免频繁重连）
  │
  ▼
重新建立 WebSocket / SSE 连接
  │
  ▼
发送带 Last-Event-ID 的握手请求
  │  Header: X-Last-Event-ID: {last_event_id}
  │
  ▼
服务端收到后，补发 [last_event_id+1, 最新] 之间的所有消息
  │
  ▼
客户端收到消息后去重（按 mid）
  │
  ▼
恢复订阅状态（重新 Subscribe）
```

### Last-Event-ID 补发协议

```
客户端请求：
  X-Last-Event-ID: 1704067200001  （最后收到消息的 ID）

服务端处理：
  1. 查询离线消息表：WHERE mid > 1704067200001 AND to_user = {user_id}
  2. 按 mid 顺序补发所有离线消息
  3. 关闭连接时未确认的消息也要补发

SSE 中的 Last-Event-ID 使用：
  每条消息带 id 字段
  客户端断连重连时带 Last-Event-ID 请求
  服务端自动补发 id > Last-Event-ID 的所有消息
```

---

## 9. 管理面 API

### 获取用户在线状态

```http
GET /admin/v1/realtime/presence/{user_id}
X-Admin-Token: {admin_token}
```

```json
{
  "user_id": "user-001",
  "online": true,
  "devices": [
    {
      "device_id": "device-abc",
      "conn_type": "websocket",
      "connected_at": "2024-06-01T10:00:00Z",
      "last_heartbeat_at": "2024-06-01T10:05:00Z",
      "current_room": "room-001"
    }
  ]
}
```

### 发送系统广播

```http
POST /admin/v1/realtime/broadcast
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "type": "announcement",
  "topics": ["all"],
  "payload": {
    "title": "系统维护通知",
    "content": "将在 22:00-23:00 进行维护",
    "maintenance_at": "2024-06-02T22:00:00Z"
  }
}
```

### 拉取离线消息

```http
GET /admin/v1/realtime/offline?user_id={user_id}&since={timestamp}&limit=100
X-Admin-Token: {admin_token}
```

```json
{
  "messages": [
    {
      "mid": "msg-001",
      "from": "user-002",
      "payload": {"content": "你好"},
      "ts": 1704067200001
    }
  ],
  "has_more": true,
  "next_cursor": "msg-100"
}
```

---

## Event Contract

| Event | 触发时机 | 消费者 |
|-------|---------|--------|
| `realtime.connection.established` | 连接建立成功 | 统计、审计 |
| `realtime.connection.closed` | 连接正常关闭 | 统计、清理资源 |
| `realtime.connection.error` | 连接异常断开 | 告警、重连处理 |
| `realtime.message.sent` | 消息发送成功 | 消息持久化 |
| `realtime.message.acked` | 消息被客户端确认 | 消息状态更新 |
| `realtime.presence.online` | 用户上线 | 房间成员通知 |
| `realtime.presence.offline` | 用户下线 | 房间成员通知 |
| `realtime.subscribe` | 用户订阅房间/主题 | 路由表更新 |
| `realtime.unsubscribe` | 用户取消订阅 | 路由表更新 |
| `realtime.heartbeat.timeout` | 心跳超时 | 连接清理 |
