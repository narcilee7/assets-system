# WebSocket Heartbeat Design

## 目标

理解 WebSocket 的全生命周期：握手协议、帧格式、心跳保活、断线重连，以及在高并发场景下的工程实践。

## 场景

- WebSocket 握手和 HTTP 有什么关系？
- 为什么需要心跳，TCP keepalive 不够吗？
- 浏览器最大 WebSocket 连接数是多少？
- 如何优雅处理百万级 WebSocket 连接？
- 负载均衡器如何支持 WebSocket？

## 握手（Handshake）

### Upgrade 机制

```
WebSocket 基于 HTTP/1.1 的 Upgrade 机制：

客户端请求：
  GET /chat HTTP/1.1
  Host: example.com
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
  Sec-WebSocket-Version: 13
  Origin: https://example.com

服务端响应（101 Switching Protocols）：
  HTTP/1.1 101 Switching Protocols
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=

Key 计算：
  Sec-WebSocket-Accept = base64(sha1(Sec-WebSocket-Key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
   magic string 是 RFC 6455 规定的固定 GUID
```

### 为什么不能直接 TCP？

```
1. 同源策略：
   - 浏览器限制 JavaScript 直接建立任意 TCP 连接
   - WebSocket 通过 HTTP 握手，受 Origin 头控制

2. 防火墙/代理兼容：
   - 80/443 端口通常开放
   - HTTP Upgrade 让代理知道后续是隧道

3. 安全协商：
   - 握手阶段可以完成 Cookie/Token 认证
   - 子协议选择（Sec-WebSocket-Protocol）
   - 扩展协商（Sec-WebSocket-Extensions，如 permessage-deflate）
```

## 帧格式

### 二进制帧结构

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
|N|V|V|V|       |S|             |   (if payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - -+
|     Extended payload length continued, if payload len == 127  |
+ - - - - - - - - - - - - - - - +-------------------------------+
|                               |Masking-key, if MASK set to 1  |
+-------------------------------+-------------------------------+
| Masking-key (continued)       |          Payload Data         |
+-------------------------------- - - - - - - - - - - - - - - -+
:                     Payload Data continued ...                :
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+
|                     Payload Data continued ...                |
+---------------------------------------------------------------+

FIN = 1: 最后一帧（完整消息），0: 分片消息还有更多帧
RSV1-3 = 0: 保留位（扩展用）
opcode:
  0x1 = text frame
  0x2 = binary frame
  0x8 = connection close
  0x9 = ping
  0xA = pong
MASK = 1: 客户端→服务端必须 mask；服务端→客户端不 mask
Payload len:
  0-125: 实际长度
  126: 后续 2 字节是实际长度
  127: 后续 8 字节是实际长度
```

### 分片（Fragmentation）

```
大消息可以分成多个帧发送：

  Frame 1: FIN=0, opcode=0x1 (text)  → 第一帧指定消息类型
  Frame 2: FIN=0, opcode=0x0 (continuation)
  Frame 3: FIN=1, opcode=0x0 (continuation) → 最后一帧 FIN=1

用途：
  - 流式发送大消息，不需要等全部数据准备好
  - 多路复用（一个消息的帧可以和其他消息交错）
  
注意：
  - 控制帧（ping/pong/close）不能分片
  - 分片消息必须按顺序发送
```

## 心跳机制

### 为什么需要心跳？

```
TCP keepalive 的问题：
  1. 超时太长：Linux 默认 2 小时才探测
  2. 无法携带应用层信息
  3. NAT/防火墙可能比 TCP keepalive 更快丢弃空闲连接
  4. 半开连接（服务端认为连接还在，客户端已断）

应用层心跳的优势：
  1. 频率可控（通常 30s）
  2. 双向探测：客户端发 ping，服务端回 pong
  3. 可以携带时间戳计算 RTT
  4. 应用层可以感知并做重连/清理
```

### WebSocket 原生 Ping/Pong

```
协议内置 ping/pong 帧：

  Client ──Ping──► Server
  Client ◄─Pong─── Server

特点：
  - ping 可以携带 payload（最多 125 字节）
  - 收到 ping 必须回复 pong
  - pong 的 payload 必须和 ping 相同
  - 可以在传输途中发送（不破坏消息流）

服务端主动 ping：
  Server ──Ping──► Client
  Server ◄─Pong─── Client
  
  如果 Client 未回复 pong → 关闭连接
```

### 工程实现

```javascript
// 客户端心跳
class WebSocketClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.heartbeatInterval = 30000;  // 30s
    this.heartbeatTimeout = 10000;   // 10s 未收到 pong 认为断开
    
    this.ws.onopen = () => this.startHeartbeat();
    this.ws.onmessage = (e) => this.handleMessage(e);
    this.ws.onclose = () => this.reconnect();
  }
  
  startHeartbeat() {
    this.pingTimer = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');  // 或用原生 ping 帧
        this.pongTimer = setTimeout(() => {
          console.log('heartbeat timeout, reconnecting');
          this.ws.close();
        }, this.heartbeatTimeout);
      }
    }, this.heartbeatInterval);
  }
  
  handleMessage(e) {
    if (e.data === 'pong') {
      clearTimeout(this.pongTimer);
      return;
    }
    // 处理业务消息
  }
  
  reconnect() {
    clearInterval(this.pingTimer);
    clearTimeout(this.pongTimer);
    // 指数退避重连
    setTimeout(() => new WebSocketClient(this.url), this.backoff());
  }
}
```

```go
// 服务端心跳（Gorilla WebSocket）
conn.SetReadDeadline(time.Now().Add(60 * time.Second))
conn.SetPongHandler(func(string) error {
    conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    return nil
})

// 定时发 ping
ticker := time.NewTicker(30 * time.Second)
defer ticker.Stop()
for range ticker.C {
    conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
    if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
        return err
    }
}
```

## 断线重连

### 重连策略

```
指数退避 + 随机抖动：

  第 1 次：wait 1s + random(0~1s)
  第 2 次：wait 2s + random(0~1s)
  第 3 次：wait 4s + random(0~1s)
  第 4 次：wait 8s + random(0~1s)
  ...
  最大间隔：60s（或自定义上限）

随机抖动目的：
  - 防止所有客户端同时重连，形成"惊群"
  - 分散服务端压力
```

### 消息可靠性

```
问题：断线期间消息可能丢失

方案 1：ACK 机制
  Client ──msg(id=1)──► Server
  Client ◄──ack(1)───── Server
  
  未收到 ack 的消息，重连后重发

方案 2：服务端持久化 + 拉取
  - 消息存入 Redis/DB
  - 客户端重连后上报 last_msg_id
  - 服务端推送离线消息

方案 3：MQTT over WebSocket
  - 使用 MQTT 的 QoS 1/2 保证送达
```

## 高并发架构

### 单机连接数

```
Linux 限制：
  - 文件描述符上限：ulimit -n（默认 1024，可调到百万）
  - 端口限制：每个远端 IP+端口组合唯一
  - 内存：每个连接约 10-50KB（取决于应用层状态）
  
100 万连接 ≈ 10-50GB 内存

优化：
  - 减少每个连接的内存占用
  - 使用 epoll/kqueue（O(1) 事件通知）
  - 避免每个连接一个 goroutine（Go 用 netpoll）
```

### 多节点扩展

```
问题：WebSocket 是有状态连接，如何水平扩展？

方案 1：Sticky Session（会话保持）
  - L4 负载均衡按 IP/端口哈希
  - 同一客户端始终落到同一节点
  - 缺点：节点故障时连接断开，无法迁移

方案 2：共享存储 + 广播
  - 连接信息存入 Redis
  - 发消息时广播到所有节点，由持有连接的节点推送
  - 缺点：广播成本高，节点数多时不适用

方案 3：消息队列 + Gateway
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ Gateway │────►│ Kafka   │────►│ Gateway │
  │ (WS)    │◄────│ (Topic) │◄────│ (WS)    │
  └─────────┘     └─────────┘     └─────────┘
  
  - Gateway 只负责 WS 连接管理
  - 业务消息通过 Kafka 路由到正确的 Gateway
  - Gateway 按 user_id 分区消费

方案 4：自定义路由层
  - 路由层维护 user_id → node 的映射
  - 发消息时先查路由，再转发到对应节点
  - 节点宕机时，客户端重连到新节点
```

### 优雅关闭

```
服务端升级/重启时：

1. 停止接收新连接（从负载均衡器摘除）
2. 向所有现有连接发送 close 帧
3. 等待客户端重连到新节点
4. 超时后强制关闭剩余连接

Go 示例：
  srv.Shutdown(ctx)  // 关闭 listener
  for _, conn := range connections {
      conn.WriteMessage(websocket.CloseMessage, 
          websocket.FormatCloseMessage(websocket.GoingAway, "server restart"))
  }
```

## 负载均衡

### 四层 vs 七层

```
L4 负载均衡（TCP）：
  - 支持 WebSocket（TCP 透传）
  - 按 IP/端口哈希（sticky）
  - 不支持按 URL/Header 路由

L7 负载均衡（HTTP）：
  - 必须支持 HTTP Upgrade
  - 可以按 Header、Cookie 路由
  - 可以终止 TLS、做 WAF

常见支持 WebSocket 的代理：
  - Nginx：proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade;
  - Envoy：原生支持，可做 WS 路由
  - HAProxy：option httpchk + tunnel
  - AWS ALB：原生支持
```

## 核心追问

1. **WebSocket 和 SSE 怎么选？** 服务端推送单向用 SSE（更简单、自动重连、基于 HTTP）；双向实时通信用 WebSocket
2. **TCP keepalive 为什么不够？** 默认 2 小时太长，NAT/防火墙超时通常 5 分钟；且 TCP keepalive 只能检测连接是否断开，不能检测应用是否存活
3. **WebSocket 安全注意事项？** 必须 WSS（TLS）；校验 Origin 防止 CSWSH；限制单 IP 连接数防 DDoS；校验帧大小防内存耗尽
4. **百万连接如何内存优化？** 减少 per-connection 状态；用 sync.Pool 复用 buffer；避免每个连接一个 goroutine（用 netpoll/epoll）；压缩 idle 连接状态
5. **WebSocket 帧的 MASK 有什么作用？** 防止代理缓存污染攻击；客户端必须 mask，服务端不 mask；mask key 随机生成，payload 逐字节 XOR

## 状态

| 资产 | 状态 |
|---|---|
| HTTP protocol comparison | done |
| gRPC deadline and streaming | done |
| WebSocket heartbeat design | done |
| SSE resume protocol | todo |
| QUIC overview | todo |
