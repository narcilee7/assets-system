# Data Model

## 核心设计原则

- **连接有状态**：长连接信息必须存在某个地方（内存或 Redis），无法完全无状态
- **消息持久化**：离线消息需要落库，在线消息可只存在于内存
- **按用户 ID 路由**：消息通过用户 ID 找到用户当前连接的节点

---

## 1. 连接状态数据（Connection Registry）

### 进程内连接表（单节点）

```go
type Connection struct {
    ConnID       string           // 连接唯一 ID（UUID）
    UserID       string
    DeviceID     string
    ConnType     string           // "websocket" | "sse"
    NodeID       string           // 当前所在节点

    // 连接上下文
    RemoteAddr   string
    ConnectedAt  int64            // Unix timestamp
    LastHeartbeatAt int64
    LastSeq      int64            // 最后收到的消息序号

    // 订阅状态
    Rooms        map[string]bool  // 用户所在的房间
    Topics       map[string]bool  // 用户订阅的主题

    // 性能指标
    ReadBufferSize  int
    WriteBufferSize  int
}

type ConnectionManager struct {
    // 按用户 ID 索引（查找某用户当前在哪）
    byUserID sync.Map  // map[string][]*Connection（一个用户可能有多个设备）

    // 按连接 ID 索引（按连接 ID 快速查找）
    byConnID sync.Map  // map[string]*Connection

    // 按房间索引（广播时快速找到所有连接）
    byRoom   sync.Map  // map[string]map[string]*Connection（room_id → conn_id → Connection）

    // 统计
    TotalConnections atomic.Int64
    TotalRooms       atomic.Int64
}
```

### Redis 连接状态（分布式跨节点）

```
# 用户当前连接信息
realtime:conn:user:{user_id}
  node_id: "node-03"
  conn_id: "conn-abc123"
  conn_type: "websocket"
  device_id: "device-abc"
  rooms: ["room-001", "room-002"]
  topics: ["order_updates"]
  heartbeat_at: 1704067200000
  # EXPIRE: 60s（心跳续命，超时则删除）

# 房间成员列表
realtime:room:{room_id}:members
  ZSET: score=join_time, value=user_id
  # 用户离开时 ZREM

# 节点上连接数（用于负载均衡）
realtime:node:{node_id}:connections
  counter: 12345
  # 每秒更新到 InfluxDB 用于监控
```

### 连接查找流程

```
要给用户 U 发送消息 M：
  1. 查 Redis：GET realtime:conn:user:{U}
  2. 获得 node_id = "node-03"
  3. 如果当前节点是 node-03 → 直接从本地连接表找到 Connection 发送
  4. 如果当前节点不是 node-03 → 通过内部网络转发到 node-03，再发送
```

---

## 2. 消息存储数据（Message Store）

### MySQL 消息表（离线消息 + 历史消息）

```sql
CREATE TABLE messages (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    mid             VARCHAR(64) NOT NULL UNIQUE,         -- 消息全局唯一 ID
    from_user_id    VARCHAR(64) NOT NULL,                 -- 发送者
    to_room_id      VARCHAR(64),                          -- 目标房间（房间消息）
    to_user_id      VARCHAR(64),                          -- 目标用户（点对点消息）
    topic           VARCHAR(256),                         -- 主题（主题消息）

    payload         JSON NOT NULL,                        -- 消息内容
    msg_type        VARCHAR(32) NOT NULL,                  -- message/ack/heartbeat/system

    -- 消息状态
    status          ENUM('pending', 'delivered', 'read', 'failed') DEFAULT 'pending',
    seq             BIGINT NOT NULL,                       -- 同一用户视角的序号（趋势递增）
    ts              BIGINT NOT NULL,                       -- 消息创建时间戳（毫秒）

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 索引
    INDEX idx_to_user_status (to_user_id, status, ts),
    INDEX idx_to_room (to_room_id, ts),
    INDEX idx_from_user (from_user_id, ts),
    INDEX idx_topic (topic, ts),
    INDEX idx_status (status),
    INDEX idx_ts_seq (ts, seq)                             -- 用于按时间排序
);

CREATE TABLE offline_message_index (
    -- 离线消息快速查找索引（只索引未送达的消息）
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         VARCHAR(64) NOT NULL,
    message_id      BIGINT NOT NULL,
    ts              BIGINT NOT NULL,

    INDEX idx_user_pending (user_id, ts)
);
```

### 消息内存缓冲区（在线消息）

```go
// 环形缓冲区，存储最近 N 条消息，用于重连补发
type MessageBuffer struct {
    maxSize int
    buf     []*Message
    mu      sync.Mutex
}

func (b *MessageBuffer) Add(msg *Message) {
    b.mu.Lock()
    defer b.mu.Unlock()
    if len(b.buf) >= b.maxSize {
        b.buf = b.buf[1:]  // 移除最老的
    }
    b.buf = append(b.buf, msg)
}

func (b *MessageBuffer) GetAfter(afterMid string) []*Message {
    // 查找 afterMid 之后的所有消息
}
```

---

## 3. 房间 / 订阅数据（Room & Topic）

### MySQL 房间表

```sql
CREATE TABLE rooms (
    id              VARCHAR(64) PRIMARY KEY,
    name            VARCHAR(256) NOT NULL,
    type            ENUM('chat', 'broadcast', 'notification') DEFAULT 'chat',
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',

    -- 权限控制
    max_members     INT DEFAULT 1000,
    is_private      BOOLEAN DEFAULT FALSE,
    require_approval BOOLEAN DEFAULT FALSE,

    -- 元数据
    metadata        JSON,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tenant (tenant_id),
    INDEX idx_type (type)
);

CREATE TABLE room_members (
    room_id         VARCHAR(64) NOT NULL,
    user_id         VARCHAR(64) NOT NULL,
    role            ENUM('owner', 'admin', 'member') DEFAULT 'member',
    joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unread_count    INT DEFAULT 0,

    PRIMARY KEY (room_id, user_id),
    INDEX idx_user (user_id)
);
```

### Redis 房间成员（实时订阅状态）

```
realtime:room:{room_id}:members
  ZSET: score=join_timestamp, value=user_id:conn_id
  # 用于快速判断用户是否在房间里，以及房间成员列表

realtime:room:{room_id}:seq
  STRING: 当前房间的 seq（消息序号）
```

---

## 4. 流式输出数据（Streaming）

### 流任务表

```sql
CREATE TABLE streams (
    id              VARCHAR(64) PRIMARY KEY,
    stream_type     ENUM('agent_output', 'file_download', 'data_pipeline') NOT NULL,
    user_id         VARCHAR(64) NOT NULL,
    task_id         VARCHAR(256),

    -- 流状态
    status          ENUM('pending', 'streaming', 'completed', 'cancelled', 'failed') DEFAULT 'pending',
    total_tokens     INT DEFAULT 0,
    output_length    INT DEFAULT 0,
    started_at       TIMESTAMP,
    ended_at         TIMESTAMP,

    metadata        JSON,

    INDEX idx_user (user_id),
    INDEX idx_status (status)
);
```

### Redis 流状态

```
# Agent 流式输出缓冲（防止客户端断连丢数据）
realtime:stream:{stream_id}
  LIST: ["今天", "天气", "很好", ...]  -- 已输出的内容片段
  metadata: {task_id, model, user_id}
  # EXPIRE: 流结束 + 5min

# 流订阅者（谁在接收这个流）
realtime:stream:{stream_id}:subscribers
  SET: conn_id1, conn_id2, ...
```

---

## 5. 用户在线状态数据（Presence）

### Redis Presence

```
# 用户在线状态
realtime:presence:{user_id}
  HASH: {
    device_id: device-abc,
    conn_type: websocket,
    last_seen: 1704067200000,
    status: online
  }
  # EXPIRE: 30s（心跳续命）

# 用户最后在线时间（离线后保留）
realtime:last_seen:{user_id}
  STRING: 1704067200000
  # EXPIRE: 永久保留（用于显示"最后在线时间"）
```

### 订阅关系变更事件

```
当用户订阅/取消订阅房间时：
  1. 更新 Redis 房间成员列表
  2. 发布订阅变更事件（Redis Pub/Sub）：
     Channel: realtime:room:{room_id}:events
     Message: {event: "join"|"leave", user_id, ts}
  3. 各节点收到事件后，更新自己的内存订阅表
```

---

## 6. 消息 ID（Snowflake）

### ID 结构

```
64-bit 消息 ID：

[1 bit unused][41 bits timestamp][10 bits node_id][12 bits sequence]
  0           timestamp(ms)   node(0-1023)  seq(0-4095)

特点：
  - 单节点内严格递增
  - 跨节点通过 node_id 保证不冲突
  - 可从 ID 反推时间（用于排序）
```

### 时钟回拨处理

```go
type Snowflake struct {
    nodeID     int64
    sequence   int64
    lastTime   int64
    mu         sync.Mutex
}

func (sf *Snowflake) NextID() int64 {
    sf.mu.Lock()
    defer sf.mu.Unlock()

    now := time.Now().UnixNano() / 1e6  // 毫秒

    if now < sf.lastTime {
        // 时钟回拨，等到回拨时间过去
        now = sf.lastTime
    }

    if now == sf.lastTime {
        sf.sequence = (sf.sequence + 1) & 0xfff
        if sf.sequence == 0 {
            // 同一毫秒 sequence 用完，等待下一毫秒
            for now <= sf.lastTime {
                now = time.Now().UnixNano() / 1e6
            }
        }
    } else {
        sf.sequence = 0
    }

    sf.lastTime = now
    return (now << 22) | (sf.nodeID << 12) | sf.sequence
}
```

---

## 7. ACK 与送达确认

### ACK 状态机

```
消息状态：
  pending → delivered → read → (可选) archived

转换条件：
  pending → delivered：消息到达客户端（TCP ACK / 应用层 ACK）
  delivered → read：用户实际看到消息（客户端主动上报）
  read → archived：用户主动清理或归档
```

### Redis 消息送达状态

```
# 消息送达状态
realtime:msg:delivered:{mid}
  HASH: {
    status: "delivered",
    delivered_at: 1704067200100,
    acked: "true"
  }
  # EXPIRE: 消息产生后 7 天

# 用户未 ACK 消息计数（用于显示未读数）
realtime:user:{user_id}:unack_count
  HASH: {room_id: count}
  # 每次消息 delivered 时 +1，收到 ACK 时 -1
```

### 客户端 ACK 机制

```
客户端收到消息后 5s 内必须回 ACK（防止消息丢失）

客户端：
  for msg in received_messages:
    send_ack(msg.mid)
    mark_as_delivered(msg.mid)  // 本地标记，UI 先显示

服务端：
  收到 ACK(msg.mid) → 更新消息状态为 delivered → 未读数 -1

如果客户端 30s 内没回 ACK：
  服务端认为消息未送达（可能是网络问题）
  保留在离线消息列表中，用户下次上线补发
```

---

## 8. 连接度量数据

### 连接表（MySQL，用于历史统计）

```sql
CREATE TABLE connection_stats (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id         VARCHAR(64) NOT NULL,
    conn_type       VARCHAR(32) NOT NULL,           -- websocket/sse
    timestamp       TIMESTAMP NOT NULL,

    -- 连接数
    active_connections INT NOT NULL,
    new_connections    INT NOT NULL,
    closed_connections INT NOT NULL,

    -- 消息数
    messages_sent      BIGINT NOT NULL,
    messages_received  BIGINT NOT NULL,

    -- 性能
    avg_latency_ms    INT DEFAULT 0,
    p99_latency_ms    INT DEFAULT 0,

    INDEX idx_node_time (node_id, timestamp),
    INDEX idx_timestamp (timestamp)
);
```

---

## 9. 离线消息索引

### 为什么需要离线索引？

```
场景：用户离线 2 小时，有 50 条消息
  → 用户上线后，需要从 Redis/MySQL 快速查出这 50 条消息
  → 不能扫描全量消息表（太慢）

方案：按 user_id + ts 建索引，只索引 offline 状态的消息
```

```sql
-- 离线消息索引（用户上线时快速查询）
CREATE TABLE offline_index (
    user_id     VARCHAR(64) NOT NULL,
    message_id  BIGINT NOT NULL,
    ts          BIGINT NOT NULL,
    delivered   BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (user_id, ts, message_id),
    INDEX idx_user_delivered (user_id, delivered, ts)
);
```

### 索引更新时机

```
消息到达服务端
  │
  ├── 目标用户在线 → 直接投递，不入离线索引
  │
  └── 目标用户离线 → 入离线索引（INSERT offline_index）
       │
       ▼
用户上线
  │
  ▼
从离线索引查出 [上次已读时间, 现在] 的所有消息
  │
  ▼
删除离线索引记录（标记 delivered = true）
  │
  ▼
补发消息给客户端
```
