# SSE Resume Protocol

## 目标

理解 Server-Sent Events（SSE）的协议机制、断线重连、事件 ID 设计，以及它与 WebSocket、长轮询的差异和选型。

## 场景

- SSE 的 `Last-Event-ID` 如何保证消息不丢失？
- SSE 和 WebSocket 在实时推送场景怎么选？
- 为什么 SSE 基于 HTTP，却比长轮询更高效？
- 如何实现 SSE 的多节点会话恢复？
- 浏览器对 SSE 有什么限制？

## 协议基础

### MIME 类型

```
Content-Type: text/event-stream

特点：
  - 基于 HTTP/1.1 持久连接
  - 单向：服务端 → 客户端
  - 文本格式，每行一个字段
```

### 消息格式

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

id: 1\n
 event: user-login\n
 data: {"user_id": 123, "name": "Alice"}\n\n

id: 2\n
 data: plain text message\n\n

: heartbeat\n\n

id: 3\n
 event: price-update\n
 data: {"symbol": "AAPL", "price": 150.25}\n\n

字段说明：
  id:    事件 ID，用于断线重连定位
  event: 事件类型，客户端按类型监听
  data:  事件数据（多行 data 会用 \n 连接）
  :      注释/心跳（以冒号开头）
  \n\n  空行表示一条消息结束
```

### 浏览器 API

```javascript
const source = new EventSource('/events');

// 监听特定事件类型
source.addEventListener('price-update', (e) => {
  const data = JSON.parse(e.data);
  console.log(data.symbol, data.price);
});

// 监听默认消息（无 event 字段）
source.onmessage = (e) => {
  console.log('msg:', e.data);
};

// 错误处理
source.onerror = (e) => {
  console.log('error, will auto-reconnect');
};

// 手动关闭
source.close();
```

## 断线重连机制

### 自动重连

```
浏览器内置自动重连：
  - 连接断开时，浏览器自动尝试重连
  - 默认重连间隔：约 3 秒（服务端可配置）
  - 重连时会带上 Last-Event-ID 头

服务端控制重连间隔：
  retry: 5000\n\n
  → 告诉浏览器 5 秒后重连
```

### Last-Event-ID 机制

```
客户端首次连接：
  GET /events
  （无 Last-Event-ID）

服务端推送：
  id: 100\n
  data: msg1\n\n

  id: 101\n
  data: msg2\n\n

  id: 102\n
  data: msg3\n\n

连接断开（网络抖动）：

客户端自动重连：
  GET /events
  Last-Event-ID: 102

服务端处理：
  - 从 ID 102 之后的消息开始推送
  - 如果 102 之后的消息还在缓冲区 → 直接推送
  - 如果已超出缓冲区 → 发送错误/全量同步

关键：
  - ID 必须单调递增（不一定是连续整数）
  - 服务端需要维护消息队列/缓冲区
  - 缓冲区大小决定可恢复的时间窗口
```

### 服务端实现

```go
type SSEServer struct {
    clients   map[string]*Client  // user_id -> client
    history   *RingBuffer         // 环形缓冲区，保存最近 N 条消息
    historyMu sync.RWMutex
}

func (s *SSEServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
        return
    }
    
    // 获取 Last-Event-ID
    lastID := r.Header.Get("Last-Event-ID")
    if lastID == "" {
        lastID = r.URL.Query().Get("lastEventId")
    }
    
    // 发送历史消息（断线恢复）
    if lastID != "" {
        messages := s.history.Since(lastID)
        for _, msg := range messages {
            fmt.Fprintf(w, "id: %s\nevent: %s\ndata: %s\n\n", 
                msg.ID, msg.Event, msg.Data)
        }
        flusher.Flush()
    }
    
    // 注册客户端，推送实时消息
    client := s.registerClient(r.Context(), w, flusher)
    <-client.Done()  // 阻塞直到连接断开
}
```

## 消息缓冲区设计

### 环形缓冲区（Ring Buffer）

```
容量：固定大小（如 1000 条消息 或 5MB）

写入：
  - 新消息追加到尾部
  - 满时覆盖最旧的消息

查询 Since(lastID)：
  - 二分查找或哈希定位 lastID
  - 返回之后的所有消息

注意事项：
  - 缓冲区太小 → 客户端重连时 lastID 已过期
  - 缓冲区太大 → 内存占用高
  - 需要 TTL：消息超过一定时间强制清理
```

### 持久化方案

```
小规模（单机/少量节点）：
  - 内存 Ring Buffer + 定期快照

大规模（多节点）：
  - Redis Stream / PubSub
  - Kafka（按 user_id 分区）
  - 客户端重连时从消息队列拉取

多节点一致性：
  - 消息先写入共享存储（Redis/Kafka）
  - 各节点消费并推送到本地连接
  - 重连时从共享存储恢复
```

## SSE vs 其他方案

### SSE vs 长轮询（Long Polling）

```
长轮询：
  Client ──请求──► Server
  Client ◄───────── Server （阻塞到有消息或超时）
  Client ──请求──► Server （立即再次请求）
  
  缺点：
    - 每次有消息都要新建 HTTP 连接
    - 高并发时连接开销大
    - 消息延迟 = 往返 RTT

SSE：
  Client ──建立连接──► Server
  Client ◄──消息1───── Server
  Client ◄──消息2───── Server
  Client ◄──消息3───── Server
  
  优点：
    - 单连接持续推送
    - 自动重连 + Last-Event-ID
    - 基于 HTTP，兼容现有基础设施
```

### SSE vs WebSocket

| 特性 | SSE | WebSocket |
|---|---|---|
| 方向 | 服务端 → 客户端（单向） | 双向 |
| 协议 | HTTP/1.1（或 HTTP/2） | WS/WSS（独立协议） |
| 重连 | 浏览器内置自动重连 | 需手动实现 |
| 断线恢复 | Last-Event-ID 原生支持 | 需自定义 ID + ACK |
| 心跳 | 服务端发注释 `:ping` | 原生 Ping/Pong 帧 |
| 二进制 | 不支持（Base64 编码） | 原生支持 |
| 压缩 | HTTP gzip | permessage-deflate |
| 浏览器连接数 | 6/域名（HTTP/1.1） | 通常更多限制 |
| 跨域 | 需 CORS | 自带 Origin 校验 |
| 代理兼容 | 好（普通 HTTP） | 需支持 Upgrade |

### 选型指南

| 场景 | 推荐方案 |
|---|---|
| 服务端单向推送（新闻、股价、日志） | SSE |
| 双向实时通信（聊天、游戏、协作） | WebSocket |
| 简单实时通知，兼容老旧基础设施 | 长轮询 |
| 高频二进制数据流（音视频） | WebRTC / WebSocket |
| 大规模广播，高扇出 | SSE + CDN / HTTP/2 Push |

## 工程实践

### 连接管理

```
浏览器限制：
  - HTTP/1.1：每个域名最多 6 个并发连接
  - 如果页面开 6 个 SSE 连接，其他 AJAX 会阻塞
  - 解决：使用 HTTP/2（多路复用无此限制）
        或合并多个 SSE 流到单一连接

连接保活：
  - 服务端定期发送 `:ping\n\n`（注释行）
  - 避免 NAT/防火墙超时断开
  - 浏览器不会触发 onmessage，但保持连接活跃
```

### 错误处理

```javascript
const source = new EventSource('/events');
let reconnectCount = 0;

source.onerror = (e) => {
  if (source.readyState === EventSource.CONNECTING) {
    console.log(`reconnecting... attempt ${++reconnectCount}`);
  } else if (source.readyState === EventSource.CLOSED) {
    console.log('connection closed permanently');
    // 达到最大重连次数，通知用户
  }
};

// 服务端控制重连间隔
// retry: 1000  → 1秒后重连
// retry: 30000 → 30秒后重连（退避）
```

### 多节点部署

```
架构：

  Client ──► Load Balancer ──► Node A (SSE 连接)
                              Node B (SSE 连接)
                              Node C (SSE 连接)
                              
消息广播：
  - 业务服务产生消息
  - 写入 Redis PubSub / Kafka
  - 各节点消费，推送到本地 SSE 连接

重连问题：
  - 客户端可能重连到不同节点
  - 节点需要共享消息历史（Redis Stream）
  - 或客户端从独立 API 拉取历史消息

优化：
  - 按 user_id 哈希路由到固定节点（sticky）
  - 减少跨节点广播
```

## HTTP/2 多路复用优化

```
HTTP/1.1 的问题：
  - SSE 占用一个持久连接
  - 同域名其他请求受 6 连接限制

HTTP/2 的优化：
  - 一个 TCP 连接上多路复用多个 Stream
  - SSE 和其他请求共享同一连接
  - 无 6 连接限制

注意：
  - 部分代理/负载均衡器对 HTTP/2 SSE 支持不佳
  - 需要测试确认
```

## L2：消息送达语义与源码锚定

### 浏览器 EventSource 重连源码（Chromium）

```cpp
// chromium/content/browser/renderer_host/sse_event_source.cc
void EventSource::OnConnectionError(...) {
    // 连接断开 → 进入 RECONNECTING 状态
    state_ = RECONNECTING;
    // 使用服务端下发的 retry 值（默认 3000ms）
    int delay = last_event_id_.empty() ? retry_ : retry_;
    // 带上 Last-Event-ID 重连
    Connect(last_event_id_);
}

// 关键：如果服务端返回 204 No Content，浏览器认为"服务端要求停止"，不再重连
if (response_code == 204) {
    state_ = CLOSED;
    return;  // 永久关闭，不再重连
}
```

**边界陷阱**：如果服务端在维护时返回 404 而非 204，EventSource 会无限重连（每次 3 秒），造成服务端压力。最佳实践：维护期间返回 `204` 或设置 `retry: 60000`（1 分钟）。

### 消息送达语义的形式化

SSE 原生提供 **at-least-once** 语义：
- 正常情况：消息按序送达。
- 网络抖动：浏览器自动重连 + `Last-Event-ID` → 服务端重发未确认消息。
- 极端情况：如果客户端在收到消息和发送下一个请求之间崩溃，消息可能丢失（没有客户端 ACK 机制）。

```
exactly-once 不可能的原因：
  - SSE 没有客户端显式 ACK
  - 服务端不知道客户端是否成功处理消息
  - 重连时服务端只能"从某个 ID 之后重发"，无法区分"客户端已收到但未处理"和"客户端未收到"

工程 workaround：
  - 客户端维护已处理消息的 ID 集合（去重）
  - 服务端消息带唯一 ID（Snowflake / UUID）
  - 客户端幂等处理
```

### 多节点共享存储的数字锚定

| 方案 | 单节点吞吐 | 跨节点延迟 | 适用规模 |
|---|---|---|---|
| 内存 Ring Buffer | 100K msg/s | 0ms | < 10 节点 |
| Redis Stream | 50K msg/s | ~1ms | < 100 节点 |
| Kafka (单分区) | 10K-50K msg/s | ~5-10ms | 无限 |
| NATS JetStream | 50K+ msg/s | ~1ms | < 1000 节点 |

**关键瓶颈**：跨节点广播的复杂度是 O(N²)（每个节点都要推送到所有持有连接的节点），超过 50 节点时应改用消息队列 + Gateway 架构。

## 核心追问

1. **SSE 的 Last-Event-ID 如果服务端找不到怎么办？** 服务端应发送全量快照或错误事件，客户端降级处理；不能静默跳过
2. **SSE 为什么不能传二进制？** 协议基于文本/event-stream；传二进制需 Base64 编码，增加 33% 开销；大二进制数据建议用 WebSocket 或单独下载链接
3. **SSE 重连时消息顺序如何保证？** 消息 ID 必须单调递增，缓冲区按序存储；多节点时需全局有序 ID（如 Snowflake）或按客户端会话保证局部有序
4. **SSE 适合多少并发连接？** 单机 10K-100K（取决于内存和架构）；大规模需多节点 + 共享存储；HTTP/2 下一连接多 Stream 更高效
5. **SSE 和 WebSocket 共存的设计？** 用 SSE 做服务端推送（新闻、通知），WebSocket 做双向交互（聊天输入）；或根据客户端能力自动降级

## 状态

| 资产 | 状态 |
|---|---|
| HTTP protocol comparison | done |
| gRPC deadline and streaming | done |
| WebSocket heartbeat design | done |
| SSE resume protocol | done |
| QUIC overview | todo |
