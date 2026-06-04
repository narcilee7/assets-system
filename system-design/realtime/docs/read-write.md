# Read & Write Path

## 消息推送核心流程

### 场景：服务器要给房间内的所有用户推送一条消息

```
用户 A（在 Node-1）在房间 R 里发消息 M
  │
  ▼
[1] Node-1 接收消息 M
    - 验证用户身份和权限
    - 持久化到 MySQL（message 表，status=pending）
    - 更新房间 seq（房间消息序号）
  │
  ▼
[2] 计算消息 ID（Snowflake）
    - mid = snowflake.NextID()
    - ts = now()
    - seq = room_seq.Increment()
  │
  ▼
[3] 查找房间 R 的所有在线成员
    - 从 Redis ZSET 获取 realtime:room:{room_id}:members
    - 得到成员列表：user1@conn1, user2@conn2, ...
  │
  ▼
[4] 按成员所在节点分组
    - Node-1 本地成员：直接发送
    - Node-2 成员：通过 Redis Pub/Sub 转发
  │
  ▼
[5] 各节点投递消息
    - 从节点本地连接表找到连接
    - 写入 WebSocket / SSE 帧
  │
  ▼
[6] 等待 ACK（可选）
    - 客户端收到后回 ACK
    - 超时 30s 未 ACK，保留为离线消息
  │
  ▼
[7] 更新消息状态
    - 所有在线成员 ACK 后，status → delivered
    - 离线成员消息保留在离线表
```

---

## 连接建立流程

### WebSocket 连接建立

```
客户端发送握手请求（含 JWT）
  │
  ▼
服务端验证 JWT
  │  - JWT 合法且未过期
  │  - 提取 user_id、roles
  │  - 检查连接数限制（每用户 max 5 个设备）
  │
  ▼
创建 Connection 对象
  │  - 生成 conn_id
  │  - 记录 user_id、device_id、node_id
  │  - 初始化订阅状态（rooms={}, topics={}）
  │
  ▼
注册连接到 ConnectionManager
  │  - byUserID[user_id] 添加连接
  │  - byConnID[conn_id] 添加连接
  │  - TotalConnections++
  │
  ▼
写入 Redis 连接状态
  │  - SET realtime:conn:user:{user_id} {...}
  │  - EXPIRE 60s（心跳续命）
  │
  ▼
发送系统消息给客户端
  │  - type: "system"
  │  - event: "connected"
  │  - content: {"session_id": "sess-xxx", "server_time": ts}
  │
  ▼
返回 101 Switching Protocols
  │
  ▼
开始心跳计时器（每 15s 发送 Ping）
```

---

## SSE 连接建立

```
客户端发起 GET /sse/v1/realtime/stream
  │
  ▼
验证 JWT（同 WebSocket）
  │
  ▼
创建 SSE 连接（与 WebSocket 不同，SSE 是 HTTP 连接）
  │
  ▼
处理 SSE 特殊 Header：
  │  - Content-Type: text/event-stream
  │  - Cache-Control: no-cache
  │  - Connection: keep-alive
  │
  ▼
立即发送一个初始消息（确认连接成功）
  │  event: system
  │  data: {"event": "connected", "ts": 1704067200001}
  │
  ▼
SSE 连接保持，客户端等待消息流
  │
  ▼
心跳：每 15s 发送一个 event: heartbeat
  │  id: {timestamp}
  │  event: heartbeat
  │  data: {"ts": 1704067200001}
  │
  ▼
断连检测：
  - 客户端断开时，服务端收到 EOF
  - 服务端心跳 45s 无响应 → 判定断连
```

---

## 心跳机制

### WebSocket 心跳（推荐使用 Ping/Pong 帧）

```go
func (c *Connection) StartHeartbeat() {
    ticker := time.NewTicker(15 * time.Second)
    go func() {
        for {
            select {
            case <-ticker.C:
                if !c.IsAlive() {
                    c.Close(1011, "heartbeat timeout")
                    return
                }
                c.WritePing()  // 发送 0x9 Ping 帧
                c.LastHeartbeatAt = time.Now().Unix()
            case <-c.closeChan:
                ticker.Stop()
                return
            }
        }
    }()
}

// 客户端收到 Ping 后应立即回 Pong
// 服务端在 5s 内没收到 Pong → 判定连接可能有问题
```

### SSE 心跳（SSE 是 HTTP，不能发 Ping/Pong 帧）

```go
func (c *SSEConnection) HeartbeatLoop() {
    ticker := time.NewTicker(15 * time.Second)
    for {
        select {
        case <-ticker.C:
            c.WriteMessage("heartbeat", fmt.Sprintf(`{"ts": %d}`, time.Now().UnixMilli()))
        case <-c.closeChan:
            ticker.Stop()
            return
        }
    }
}
```

### 重连检测（客户端侧）

```go
// 客户端心跳重连逻辑
const (
    heartbeatInterval = 15 * time.Second
    reconnectDelay    = 1 * time.Second
    maxReconnectDelay = 30 * time.Second
)

func (client *WSClient) ReconnectLoop() {
    for {
        err := client.Connect()
        if err != nil {
            delay := min(reconnectDelay * 2, maxReconnectDelay)
            time.Sleep(delay)
            reconnectDelay *= 2  // 指数退避
            continue
        }

        // 连接成功，重置退避
        reconnectDelay = 1 * time.Second

        // 告知服务器最后收到的消息 ID，用于补发离线消息
        client.SendLastEventID()
    }
}
```

---

## 消息路由：按连接类型分发

### 同一消息需要同时发给 WebSocket 和 SSE 客户端

```
消息 M 到达服务端
  │
  ▼
路由层查询：用户 U 当前有几个连接？
  │
  ├── 连接1：WebSocket（device-1）
  │    └── 发送 Text 帧
  │
  ├── 连接2：SSE（device-2）
  │    └── 写入 SSE 流（text/event-stream 格式）
  │
  └── 都没有在线
       └── 消息持久化到离线表
```

### 消息写入连接

```go
// WebSocket 写入
func (conn *WebSocketConn) Send(msg *Message) error {
    data, _ := json.Marshal(msg)
    return conn.WriteMessage(websocket.TextMessage, data)
}

// SSE 写入（SSE 是 text/event-stream 格式）
func (conn *SSEConn) Send(msg *Message) error {
    // SSE 格式：id + event + data
    id := fmt.Sprintf("id: %s", msg.MID)
    event := fmt.Sprintf("event: %s", msg.Type)
    data := fmt.Sprintf("data: %s", json.Marshal(msg.Payload))
    format := "%s\nevent: %s\ndata: %s\n\n"
    _, err := fmt.Fprintf(conn, format, id, event, data)
    return err
}
```

---

## 流式输出流程（Agent 场景）

### 场景：大语言模型一个字一个字地输出，需要实时推送

```
用户发起 Agent 请求
  │
  ▼
服务端与 LLM 建立流式响应（HTTP chunked / gRPC streaming）
  │
  ▼
创建流任务（stream_id = snowflake.NextID()）
  │
  ▼
向 Redis 广播：新流开始
  │  Channel: realtime:stream:{stream_id}
  │  Message: {type: "stream_start", stream_id, metadata}
  │
  ▼
每个输出 token 到来时：
  │  // 例如：输出 "今天" 两个字
  │  收到 token "今" → 发送 stream_data（seq=1）
  │  收到 token "天" → 发送 stream_data（seq=2）
  │  收到 token "天"（第二个）→ 发送 stream_data（seq=3）
  │
  ▼
流结束时：
  │  发送 stream_end（包含完整内容、token 统计、延迟）
  │  清理 Redis 流缓冲
```

### 流式消息格式

```json
// stream_start
{
  "type": "stream_start",
  "stream_id": "stream-abc123",
  "metadata": {"model": "gpt-4", "task_id": "task-xyz"}
}

// stream_data（每收到一个 token/片段发送一条）
{
  "type": "stream_data",
  "stream_id": "stream-abc123",
  "seq": 1,
  "content": "今"
}
{
  "type": "stream_data",
  "stream_id": "stream-abc123",
  "seq": 2,
  "content": "天"
}

// stream_end
{
  "type": "stream_end",
  "stream_id": "stream-abc123",
  "seq": 3,
  "content": "今天天气很好",
  "done": true,
  "usage": {"tokens": 123, "latency_ms": 2345}
}
```

---

## 断连重连与消息补发

### 服务端断连处理

```
检测到连接断开（读超时 / 收到 close 帧）
  │
  ▼
[1] 清理本地状态
    - 从 ConnectionManager 移除连接
    - byUserID[user_id] 移除该连接
    - byRoom[room_id] 移除该连接
    - TotalConnections--
  │
  ▼
[2] 清理 Redis 状态
    - DEL realtime:conn:user:{user_id}:{device_id}
    - ZREM realtime:room:{room_id}:members {user_id}
  │
  ▼
[3] 发布断连事件
    - Redis Pub/Sub: realtime:user:{user_id}:events
    - 事件类型：offline
  │
  ▼
[4] 广播给房间成员（可选）
    - 通知房间内其他用户：该用户已离线
    - type: "presence", event: "offline"
```

### 客户端重连补发流程

```
客户端网络恢复，重新建立连接
  │
  ▼
发送握手请求，带上 X-Last-Event-ID Header
  │  Header: X-Last-Event-ID: msg-01HV3WWZP1A3B5C6D7E8F9G0H
  │  （值为本地最后收到的消息 ID）
  │
  ▼
服务端收到后，查询离线消息
  │  - SELECT * FROM messages WHERE mid > {last_event_id}
  │    AND (to_user = {user_id} OR to_room IN ({user_rooms}))
  │  - 按 mid 排序
  │
  ▼
按顺序补发所有离线消息（每条一个 WebSocket 帧 / SSE 事件）
  │
  ▼
补发完成后，发送 reconnect 事件
  │  event: system
  │  data: {"event": "reconnected", "missed_count": 42}
  │
  ▼
客户端收到消息后去重（按 mid）
  │  - 客户端本地有一个 last_received_mid
  │  - 收到的消息 mid > last_received_mid 才处理
```

---

## 房间消息广播（跨节点）

### Redis Pub/Sub 实现跨节点广播

```go
// Node-1 上用户发送消息到房间 R
func (s *Server) BroadcastToRoom(roomID string, msg *Message) error {
    // 1. 查找房间所有成员
    members, err := s.redis.ZRange("realtime:room:"+roomID+":members", 0, -1)
    if err != nil {
        return err
    }

    // 2. 按节点分组
    nodeGroups := make(map[string][]string)
    for _, m := range members {
        nodeID := extractNodeID(m)  // 从 user@node 格式提取 node_id
        nodeGroups[nodeID] = append(nodeGroups[nodeID], m)
    }

    // 3. 本地直接发送，远程通过 Redis Pub/Sub
    for nodeID, memberList := range nodeGroups {
        if nodeID == currentNodeID {
            // 本地节点：直接发送
            for _, member := range memberList {
                conn := s.connManager.GetByConnID(member.ConnID)
                conn.Send(msg)
            }
        } else {
            // 其他节点：通过 Redis Pub/Sub
            payload, _ := json.Marshal(map[string]interface{}{
                "action": "send_to_conns",
                "conns":  memberList,
                "message": msg,
            })
            s.redis.Publish("realtime:node:"+nodeID+":broadcast", payload)
        }
    }
    return nil
}

// Node-2 收到 Pub/Sub 消息后处理
func (s *Server) HandleNodeBroadcast(ch <-chan *redis.Message) {
    for msg := range ch {
        var payload map[string]interface{}
        json.Unmarshal(msg.Payload, &payload)

        if payload["action"] == "send_to_conns" {
            connIDs := payload["conns"].([]string)
            message := payload["message"].(*Message)
            for _, connID := range connIDs {
                conn := s.connManager.GetByConnID(connID)
                if conn != nil {
                    conn.Send(message)
                }
            }
        }
    }
}
```

---

## 消息顺序保证

### 乱序场景分析

```
发送顺序：M1 → M2 → M3
由于网络原因，客户端收到顺序：M1 → M3 → M2

问题：
  - 如果 M2 是 M3 的回复，乱序会导致对话不合逻辑
  - 按到达顺序展示会出现"先收到回复再收到原消息"

解决方案：客户端按消息 ts 或 seq 排序，而非按到达顺序
```

### 服务端 seq 管理

```go
type RoomSeq struct {
    roomID     string
    currentSeq atomic.Int64
}

// 每条消息递增 seq
func (s *RoomSeq) Next() int64 {
    return s.currentSeq.Add(1)
}

// 消息发送时携带 seq
msg := &Message{
    MID:  snowflake.NextID(),
    Seq:  s.roomSeq.Next(),
    TS:   time.Now().UnixMilli(),
    // ...
}
```

### 客户端排序

```go
type MessageQueue struct {
    messages   []*Message
    maxSize   int
    mu        sync.Mutex
}

func (q *MessageQueue) Add(msg *Message) {
    q.mu.Lock()
    defer q.mu.Unlock()

    // 插入排序（按 seq）
    idx := sort.Search(len(q.messages), func(i int) bool {
        return q.messages[i].Seq >= msg.Seq
    })

    if idx < len(q.messages) && q.messages[idx].MID == msg.MID {
        return  // 已存在的消息（重发），忽略
    }

    q.messages = append(q.messages, nil)
    copy(q.messages[idx+1:], q.messages[idx:])
    q.messages[idx] = msg

    // 超出上限，移除最老的
    if len(q.messages) > q.maxSize {
        q.messages = q.messages[1:]
    }
}
```

---

## 消息持久化路径

### 在线消息（短流程）

```
消息到达
  │
  ▼
持久化到 MySQL（异步写入，不阻塞投递）
  │  goroutine: go db.InsertMessage(msg)
  │
  ▼
投递到在线用户
  │
  ▼
收到 ACK 后更新状态（delivered）
```

### 离线消息（长流程）

```
消息到达
  │
  ▼
查询目标用户是否在线
  │  Redis: EXISTS realtime:conn:user:{user_id}
  │
  ├── 在线 → 直接投递，跳过离线存储
  │
  └── 离线
       │
       ▼
持久化到 MySQL（status=pending）
       │
       ▼
写入离线索引
       │  INSERT INTO offline_index (user_id, message_id, ts)
       │
       ▼
更新用户离线消息计数
           INCR realtime:user:{user_id}:offline_count
```
