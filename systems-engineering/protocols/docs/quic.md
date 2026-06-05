# QUIC Overview

## 目标

理解 QUIC 协议的核心设计：基于 UDP 的可靠传输、0-RTT 握手、连接迁移、拥塞控制，以及它如何支撑 HTTP/3 和下一代网络架构。

## 场景

- QUIC 为什么在弱网环境下比 TCP 快？
- 0-RTT 的安全隐患是什么，如何缓解？
- QUIC 的连接 ID 如何解决 NAT 重绑定？
- 为什么 QUIC 在用户态实现，而不是内核？
- QUIC 的拥塞控制和 TCP 有什么不同？

## 设计动机

### TCP 的局限

```
1. 队头阻塞（Head-of-Line Blocking）
   - TCP 是字节流，丢一个包阻塞所有后续数据
   - HTTP/2 多路复用了一个 TCP 连接，问题更严重

2. 握手延迟
   - TCP 三次握手 + TLS 握手 = 2-3 RTT
   - 移动端网络 RTT 可能 100-300ms

3. 连接迁移困难
   - TCP 连接由 (IP, port) 四元组标识
   - 手机切 WiFi/4G → IP 变 → 连接断开

4. 中间设备僵化（Middlebox Ossification）
   - NAT、防火墙、代理深度检查 TCP
   - TCP 选项经常被剥离或修改
   - 新 TCP 特性（如 Multipath TCP）难以部署
```

### QUIC 的解决思路

```
基于 UDP：
  - UDP 头简单，中间设备不深度检查
  - 在应用层实现可靠传输、拥塞控制
  - 避免内核 TCP 栈的僵化

关键设计：
  1. Stream 级独立传输（无队头阻塞）
  2. 集成 TLS 1.3（1-RTT / 0-RTT）
  3. Connection ID（连接不绑定 IP/端口）
  4. 用户态实现（快速迭代）
```

## 协议架构

### 分层

```
HTTP/3
  │
  ▼
QUIC 传输层
  ├── Stream 多路复用
  ├── 可靠传输（ACK、重传）
  ├── 流量控制（Flow Control）
  ├── 拥塞控制（Congestion Control）
  └── 集成 TLS 1.3
  │
  ▼
UDP
  │
  ▼
IP
```

### 包结构

```
QUIC 包头：

Long Header（握手阶段）：
  ┌─────────────────────────────────────┐
  │ 1ST │ Version (32)                  │
  ├─────────────────────────────────────┤
  │ DCIL │ SCIL │ Dst Connection ID (变长)│
  ├─────────────────────────────────────┤
  │ Src Connection ID (变长)            │
  └─────────────────────────────────────┘

Short Header（数据传输阶段）：
  ┌─────────────────────────────────────┐
  │ 0ST │ Spin │ KP │ PN Length │ Key Phase│
  ├─────────────────────────────────────┤
  │ Dst Connection ID (变长)            │
  ├─────────────────────────────────────┤
  │ Packet Number (变长)                │
  └─────────────────────────────────────┘

特点：
  - Short Header 最小化 overhead（ Connection ID + Packet Number）
  - 除 Version Negotiation 和 Public Reset 外，所有包加密
  - 中间设备无法解析 QUIC 包内容（防 ossification）
```

## Stream 多路复用

### 独立可靠传输

```
QUIC 连接内的多个 Stream：

  Connection
    ├── Stream 1: ──[帧1]──[帧2]────[帧3]──►
    ├── Stream 3: ──[帧A]──[帧B]──[帧C]────►
    └── Stream 5: ──[帧X]────────[帧Y]────►

每个 Stream：
  - 独立的滑动窗口
  - 独立的 ACK 和重传
  - 独立的流控

丢包影响：
  - Stream 1 的包丢失 → 只阻塞 Stream 1
  - Stream 3 和 Stream 5 不受影响
  
对比 HTTP/2 over TCP：
  - TCP 丢包 → 所有 Stream 都被阻塞
```

### Stream ID 设计

```
Stream ID 编码语义：

  | 第 1 位 | 第 2 位 | 含义 |
  |---------|---------|------|
  | 0       | 0       | 客户端发起的 Bidirectional Stream |
  | 0       | 1       | 服务端发起的 Bidirectional Stream |
  | 1       | 0       | 客户端发起的 Unidirectional Stream |
  | 1       | 1       | 服务端发起的 Unidirectional Stream |

Bidirectional：双方都能发送和接收
Unidirectional：只能由发起方发送，接收方只读

HTTP/3 使用：
  - 请求/响应：Bidirectional Stream
  - 服务端推送：Unidirectional Stream
  - 控制消息：Stream 0（预留）
```

## 握手与 0-RTT

### 首次连接（1-RTT）

```
Client                                    Server
   │                                         │
   │── Initial [CHLO + TLS ClientHello] ────►│
   │                                         │
   │◄── Initial [SHLO + TLS ServerHello] ───│
   │    [EncryptedExtensions + Certificate]  │
   │    [Finished]                           │
   │                                         │
   │── Handshake [TLS Finished] ────────────►│
   │                                         │
   │── 1-RTT Data [HTTP 请求] ──────────────►│
   │                                         │
   │◄── 1-RTT Data [HTTP 响应] ─────────────│

Initial 包：
  - 使用固定的初始密钥（从 Destination Connection ID 派生）
  - 用于加密前交换握手数据
  
Handshake 完成后：
  - 密钥升级到前向安全（Forward Secret）
  - 后续数据用新密钥加密
```

### 0-RTT 重连

```
Client（有之前会话的票据）               Server
   │                                         │
   │── Initial [CHLO + 0-RTT Token] ────────►│
   │── 0-RTT Data [HTTP 请求] ──────────────►│  ← 立即发数据！
   │                                         │
   │◄── Initial [SHLO] ─────────────────────│
   │                                         │
   │── Handshake [TLS Finished] ────────────►│
   │                                         │
   │◄── 1-RTT Data [HTTP 响应] ─────────────│

0-RTT 数据特点：
  - 用前一次会话的密钥加密
  - 不等握手完成就发送
  - 节省 1 个 RTT

安全隐患：
  - 重放攻击：攻击者可以截获 0-RTT 包并重放
  - 缓解：
    1. 0-RTT 数据只做幂等操作（GET、HEAD）
    2. 服务端限制 0-RTT 数据大小
    3. 使用 anti-replay token（类似 TLS ticket）
```

## 连接迁移

### 原理

```
TCP 连接标识：
  (源 IP, 源端口, 目的 IP, 目的端口)
  
  手机 WiFi → 4G：
    源 IP 从 192.168.1.100 变为 10.0.0.5
    → 四元组变化 → TCP 连接断开

QUIC 连接标识：
  Connection ID（64 位或更长）
  
  手机 WiFi → 4G：
    源 IP 变化
    → 但包里的 Destination Connection ID 不变
    → 服务端识别为同一连接
    → 继续传输，无需重连
```

### NAT 重绑定

```
场景：NAT 网关重启或超时，映射的端口变了

TCP：
  NAT 端口变了 → 四元组变了 → RST → 连接断开

QUIC：
  NAT 端口变了 → Connection ID 没变 → 正常处理
  
  服务端看到新的 (IP, port)，但 CID 匹配 → 更新路径
  发送 PATH_CHALLENGE 验证新路径可达
```

### 路径验证

```
连接迁移时的安全验证：

  Client（新路径）               Server
     │                             │
     │── Packet (新 IP) ──────────►│
     │                             │
     │◄── PATH_CHALLENGE ─────────│
     │                             │
     │── PATH_RESPONSE ───────────►│
     │                             │
     │◄── 确认，继续使用新路径 ─────│

防止攻击：
  - 攻击者伪造源 IP 发送包
  - 服务端不立即迁移，先发 challenge
  - 只有能收到 challenge 的合法客户端才能响应
```

## 拥塞控制

### 可插拔设计

```
QUIC 在用户态实现拥塞控制，易于实验和部署：

常见算法：
  - Reno：传统 AIMD
  - CUBIC：Linux 默认，高带宽延迟积网络
  - BBR：Google 开发，基于带宽和 RTT 估计

对比 TCP：
  - TCP 拥塞控制在内核，升级慢
  - QUIC 应用层可灵活选择算法
```

### BBR（Bottleneck Bandwidth and RTT）

```
核心思想：
  - 不依赖丢包判断拥塞
  - 直接测量带宽和 RTT

状态机：
  STARTUP：指数增长探测带宽
  DRAIN：排出队列
  PROBE_BW：周期性地轻微增减发送速率，探测最新带宽
  PROBE_RTT：定期降低 inflight，测量最小 RTT

优势：
  - 高吞吐：充分利用带宽
  - 低延迟：控制队列长度
  - 抗丢包：不像 Reno/CUBIC 丢包就大幅降速

适用：
  - 视频流、大文件传输
  - 高带宽延迟积网络（跨洋、卫星）
```

## 与 HTTP/3 的关系

```
HTTP/3 映射到 QUIC：

  请求/响应：
    - 每个请求在一个独立的 Bidirectional Stream 上
    - 类似 HTTP/2 的 Stream，但无 TCP 队头阻塞

  头部压缩：
    - HTTP/2: HPACK（依赖有序传输）
    - HTTP/3: QPACK（支持乱序，适配 QUIC Stream）
    - QPACK 使用独立的 Unidirectional Stream 同步动态表

  服务端推送：
    - HTTP/2: 服务端主动 PUSH_PROMISE
    - HTTP/3: 基于客户端订阅的 CACHE_DIGEST
```

## 部署与挑战

### 服务端实现

| 实现 | 语言 | 特点 |
|---|---|---|
| quiche | Rust | Cloudflare 出品，生产级 |
| msquic | C | Microsoft 出品，Windows 集成好 |
| ngtcp2 | C | libcurl 使用，轻量 |
| lsquic | C | LiteSpeed，事件驱动 |
| Cronet | C++ | Chromium 网络栈，Android 内置 |
| quic-go | Go | 纯 Go，易集成 |

### 挑战

```
1. 用户态开销：
   - 每个连接需要维护加密状态、拥塞控制状态
   - 内存占用比内核 TCP 高
   - 解决：内核加速（如 Linux kTLS）、硬件卸载

2. UDP 限制：
   - 企业防火墙可能限制 UDP 速率或完全阻断
   - NAT 超时短，需要更频繁的 keepalive
   - 解决：fallback 到 TCP/HTTP/2

3. 负载均衡：
   - L4 负载均衡看不到 QUIC 的 Connection ID
   - 需要 L7 代理（如 Envoy）或支持 QUIC 的 LB
   - 或 CONNECTION_MIGRATION 配合新路径

4. 调试困难：
   - 所有包加密，tcpdump 看不到内容
   - 需要 QUIC 特定的抓包工具（如 qlog）
```

## 核心追问

1. **QUIC 0-RTT 为什么有重放风险？** 0-RTT 数据在完整握手前发送，攻击者可以截获并重放相同包；缓解方案是限制 0-RTT 只做幂等操作 + anti-replay token
2. **QUIC 的 Connection ID 会不会被中间设备用于跟踪？** 会，所以 QUIC 支持 Connection ID 迁移（服务端可以发送 NEW_CONNECTION_ID，客户端切换），增加隐私性
3. **QUIC 为什么比 TCP + TLS 1.3 还快？** 集成握手：QUIC 的 Initial 包同时携带传输层握手和 TLS ClientHello；TCP 需要先三次握手，再 TLS 握手
4. **QUIC 在内核实现会更好吗？** 长期看可能，但用户态实现允许快速迭代新特性（如 BBRv2）、绕过中间设备僵化；Linux 已添加 UDP GSO/GRO 加速
5. **HTTP/3 的 QPACK 和 HTTP/2 的 HPACK 有什么区别？** HPACK 依赖有序传输（动态表按序更新），在 QUIC 乱序 Stream 下会出错；QPACK 用独立 Stream 同步动态表，支持乱序

## 状态

| 资产 | 状态 |
|---|---|
| HTTP protocol comparison | done |
| gRPC deadline and streaming | done |
| WebSocket heartbeat design | done |
| SSE resume protocol | done |
| QUIC overview | done |
