# HTTP Protocol Comparison

## 目标

理解 HTTP/1.1、HTTP/2、HTTP/3 的核心差异：连接模型、队头阻塞、多路复用、传输层选择，以及它们如何影响现代 Web 性能。

## 场景

- 为什么 HTTP/1.1 需要域名分片（domain sharding）？
- HTTP/2 的多路复用解决什么问题，又带来什么问题？
- HTTP/3 基于 QUIC/UDP，为什么比 TCP 快？
- 从 HTTP/1.1 升级到 HTTP/2，性能一定提升吗？
- 什么时候还应该用 HTTP/1.1？

## HTTP/1.1

### 连接模型

```
默认持久连接（Keep-Alive）：
  Connection: keep-alive
  
一个 TCP 连接上串行发送请求：
  → GET /a.html
  ← 200 OK (a.html)
  → GET /b.css
  ← 200 OK (b.css)
  → GET /c.js
  ← 200 OK (c.js)
```

### 队头阻塞（Head-of-Line Blocking）

```
问题：一个连接上的请求必须按顺序响应

  请求1: GET /a.html   ────────────────► 慢（10s）
  请求2: GET /b.css    ────────► 快（100ms），但必须等请求1完成后才能发送
  请求3: GET /c.js     ───► 快（50ms），等请求1、2

结果：后面的快请求被前面的慢请求阻塞
```

### 缓解手段

```
1. 浏览器并发连接：
   每个域名 6-8 个 TCP 连接（Chrome 默认 6）

2. 域名分片（Domain Sharding）：
   static1.example.com
   static2.example.com
   static3.example.com
   → 每个域名 6 个连接，共 18 个并发

3. 资源内联（Inlining）：
   把 CSS/JS 直接嵌入 HTML，减少请求数

4. 精灵图（Sprite）：
   多张小图合并成一张大图

代价：
  - 连接数爆炸，消耗服务端资源
  - TCP 慢启动重复进行
  - 域名分片增加 DNS 解析开销
```

### 管线化（Pipelining）

```
HTTP/1.1 支持 pipelining：
  → GET /a
  → GET /b
  → GET /c
  ← 200 a
  ← 200 b
  ← 200 c

问题：
  - 服务端必须按顺序响应
  - 中间某个响应慢，后面全阻塞
  - 很多代理/服务端实现 buggy
  
现状：基本废弃，被 HTTP/2 取代
```

## HTTP/2

### 核心改进

```
1. 二进制分帧（Binary Framing）
2. 多路复用（Multiplexing）
3. 头部压缩（HPACK）
4. 服务端推送（Server Push）
5. 流优先级（Stream Priority）
6. 流量控制（Flow Control）
```

### 二进制分帧

```
HTTP/2 把数据切成帧（Frame）：

┌─────────────────────────────────────┐
│ Length (24) │ Type (8) │ Flags (8)  │
├─────────────────────────────────────┤
│ R │ Stream Identifier (31)          │
├─────────────────────────────────────┤
│           Payload (变长)             │
└─────────────────────────────────────┘

帧类型：
  HEADERS   = 0x1  （请求/响应头）
  DATA      = 0x0  （请求/响应体）
  SETTINGS  = 0x4  （连接配置）
  WINDOW_UPDATE = 0x8 （流量控制）
  PRIORITY  = 0x2  （优先级）
  RST_STREAM = 0x3 （取消流）
  PING      = 0x6  （心跳）
  GOAWAY    = 0x7  （连接关闭）
```

### 多路复用（Multiplexing）

```
一个 TCP 连接上并行传输多个 Stream：

  Stream 1: ──[HEADERS: GET /a]──[DATA]─────────────────────────►
  Stream 3: ──[HEADERS: GET /b]──[DATA]──[DATA]───────────────►
  Stream 5: ──[HEADERS: GET /c]──[DATA]──[DATA]──[DATA]──────►
  Stream 7: ──[HEADERS: POST /d]──[DATA]───────────────────────►
            ↑ 交错在一个 TCP 连接上发送

每个 Stream 独立：
  - 有独立的 Stream ID（奇数客户端发起，偶数服务端发起）
  - 可以独立取消（RST_STREAM）
  - 可以设置优先级
  
解决 HTTP/1.1 的队头阻塞：
  - 应用层队头阻塞解决：快请求的帧可以插队发送
```

### 头部压缩（HPACK）

```
问题：HTTP/1.1 每次请求都重复发送大量头部
  Host: example.com
  User-Agent: Mozilla/5.0
  Accept: text/html
  Cookie: xxx（可能几 KB）

HPACK 机制：
  1. 静态表：预定义 61 个常用头部（:method: GET 等）
  2. 动态表：连接级 FIFO，缓存出现过的头部
  3. Huffman 编码：对字符串值压缩

效果：
  后续请求头部可能只需几个字节
```

### HTTP/2 的 TCP 队头阻塞

```
虽然 HTTP/2 解决了应用层队头阻塞，但底层仍是 TCP：

  Stream 1 的帧: ──[帧1]──[帧2]──[帧3]────────────►
  Stream 3 的帧: ──[帧A]──[帧B]──[帧C]──[帧D]────►
                         ↑
                      TCP 流
                      
如果 TCP 丢了一个包（属于 Stream 1）：
  - TCP 必须重传丢包
  - 后续所有 Stream 的帧都要等重传完成
  - Stream 3 的帧明明已收到，但被 TCP 阻塞

这是 HTTP/2 的根本局限：TCP 层队头阻塞
```

### 服务端推送（Server Push）

```
场景：客户端请求 index.html，服务端知道还需要 style.css

传统：
  Client → GET /index.html
  Client ← 200 index.html
  Client 解析 HTML → 发现需要 style.css
  Client → GET /style.css
  Client ← 200 style.css

Server Push：
  Client → GET /index.html
  Server ← 200 index.html
  Server ← PUSH_PROMISE style.css  （主动推送）
  Server ← 200 style.css
  
现状：
  - 很多 CDN/浏览器已禁用或限制
  - 缓存协商复杂（客户端可能已有缓存）
  - 容易被滥用浪费带宽
```

## HTTP/3

### 基于 QUIC

```
HTTP/3 = HTTP over QUIC
QUIC = Quick UDP Internet Connections

核心改变：
  HTTP/1.1 ──TCP──►
  HTTP/2   ──TCP──►
  HTTP/3   ──UDP/QUIC──►
```

### QUIC 解决 TCP 队头阻塞

```
QUIC 在 UDP 上实现自定义的可靠传输：

TCP（HTTP/2）：
  一个连接 → 一个字节流 → 丢包阻塞所有流

QUIC（HTTP/3）：
  一个连接 → 多个独立的 Stream
  每个 Stream 有自己的滑动窗口和重传机制
  
  Stream 1 丢包：只阻塞 Stream 1，不影响 Stream 3、5、7
```

### 0-RTT 连接建立

```
TCP + TLS 1.2：
  Client → SYN
  Server ← SYN-ACK
  Client → ACK + ClientHello
  Server ← ServerHello + Certificate
  Client → Finished
  Client → HTTP 请求
  
  总耗时：2-3 RTT

TCP + TLS 1.3：
  Client → SYN + ClientHello
  Server ← SYN-ACK + ServerHello + {EncryptedExtensions}
  Client → ACK + Finished + HTTP 请求
  
  总耗时：1-2 RTT

QUIC + TLS 1.3：
  首次连接：1-RTT（类似 TLS 1.3）
  
  后续连接（有之前会话的票据）：
    Client → QUIC Initial + HTTP 请求（0-RTT）
    Server ← QUIC Handshake + HTTP 响应
    
  总耗时：0-RTT！
```

### 连接迁移

```
TCP 连接由四元组标识：
  (源 IP, 源端口, 目的 IP, 目的端口)
  
手机从 WiFi 切换到 4G：IP 变了 → TCP 连接断开 → 重新建立

QUIC 连接由 Connection ID 标识：
  - 不绑定 IP/端口
  - IP 变了，Connection ID 不变
  - 无缝迁移，无需重新握手
```

### QUIC 的代价

```
1. 用户态实现：
   - TCP 在内核，QUIC 在用户态（crong、lsquic）
   - 每个连接消耗更多内存
   - 需要应用自己集成

2. UDP 被限制：
   - 企业防火墙可能阻断 UDP
   - QoS 对 UDP 不友好

3. 中间设备：
   - NAT 超时短（UDP 无连接状态）
   - 需要 keepalive 更频繁
```

## 协议对比

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| 传输层 | TCP | TCP | UDP (QUIC) |
| 并行请求 | 多连接（6-8/域） | 单连接多路复用 | 单连接多路复用 |
| 应用层队头阻塞 | 有 | 无 | 无 |
| 传输层队头阻塞 | 有 | 有 | 无 |
| 头部压缩 | 无 | HPACK | QPACK |
| 连接建立 | 1-RTT (TCP) | 1-RTT + TLS | 0-RTT (QUIC) |
| 连接迁移 | 无 | 无 | 有 |
| 服务端推送 | 无 | 有（基本废弃） | 有（重新设计） |
| 加密 | 可选 TLS | 事实强制 TLS | 强制 TLS 1.3 |

## 选型建议

| 场景 | 推荐协议 | 理由 |
|---|---|---|
| 内部服务/API | HTTP/1.1 或 HTTP/2 | 简单兼容性好 |
| 公网 Web/移动端 | HTTP/3 | 弱网、连接迁移、0-RTT |
| 高并发网关 | HTTP/2 | 多路复用减少连接数 |
| 实时流媒体 | HTTP/3 | 无队头阻塞，低延迟 |
| 老旧客户端兼容 | HTTP/1.1 | 最大化兼容性 |

## 核心追问

1. **HTTP/2 解决了队头阻塞，为什么 HTTP/3 还需要 QUIC？** HTTP/2 只解决了应用层队头阻塞，TCP 层的队头阻塞仍在；QUIC 在 UDP 上实现 Stream 级独立重传，彻底消除传输层队头阻塞
2. **HTTP/2 的域名分片还有用吗？** 没用，反而有害。HTTP/2 建议单连接，分片会浪费连接资源、降低压缩效率
3. **QUIC 0-RTT 的安全隐患？** 0-RTT 数据可能被重放攻击，敏感操作不应放在 0-RTT 中
4. **为什么 HTTP/3 强制 TLS 1.3？** QUIC 的握手集成了 TLS 1.3，加密是协议设计的一部分，不是可选层
5. **HTTP/2 服务端推送为什么被弃用？** 缓存协商复杂，推送内容可能客户端已有缓存，浪费带宽；HTTP/3 用 CACHE_DIGEST 改进

## 状态

| 资产 | 状态 |
|---|---|
| HTTP protocol comparison | done |
| gRPC deadline and streaming | todo |
| WebSocket heartbeat design | todo |
| SSE resume protocol | todo |
| QUIC overview | todo |
