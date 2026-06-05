# HTTP Versions Comparison

## 目标

理解 HTTP/1.1、HTTP/2、HTTP/3 的演进：解决了什么问题，又带来了什么新问题。

## 场景

- 为什么 HTTP/2 的 multiplexing 能提升性能，但在高丢包率网络下反而变差？
- HTTP/3 (QUIC) 为什么能完全解决队头阻塞？
- TLS 1.3 为什么比 1.2 快？
- 实际选型：什么场景用 HTTP/1.1，什么场景用 HTTP/2，什么场景用 HTTP/3？

## HTTP/1.1 的问题

### 队头阻塞（Head-of-Line Blocking）

```
请求1: =====>
响应1: <=====

请求2:         =====>
响应2:               <=====  (必须等请求1完成才能处理请求2)
```

- 浏览器只能在一个 TCP 连接上顺序发请求
- 一个请求慢，后续全部等待
- **解决方案**：多个域名、Cookie free 域名、sprites、inline

### Keep-Alive 限制

```
TCP 连接保持，不关闭
请求1: =====>
响应1: <=====
请求2: =====>
响应2: <=====
请求3: =====>
响应3: <=====
```

- 解决了频繁建连的问题（减少了 TCP 三次握手）
- 但每个请求还是要等前一个完成（队头阻塞）
- **Pipeline（管线化）**：尝试在一个连接上同时发多个请求，但不普及（代理/服务器兼容性问题）

### Header 重复

```
请求头每次都重复发送：
GET / HTTP/1.1
Host: example.com
User-Agent: curl/7.68
Accept: */*
（大量重复：Cookie、Accept 等每次都相同）
```

- HTTP/1.1 的 header 是纯文本，冗余大
- 每次请求带完整的 Cookie、User-Agent、Accept-Language
- 大 header（几百字节到几 KB）严重影响性能

### 资源消耗

- 每个 TCP 连接需要维护：拥塞窗口、 buffers、state
- 浏览器通常限制每个域名 6 个并发连接（现代浏览器放宽到 100+）

## HTTP/2 的改进

### Multiplexing（多路复用）

```
单一 TCP 连接上，多个流并发：
流1: 请求1 =====>   响应1 <=====
流2:       请求2 =====>   响应2 <=====
流3:           请求3 =====>   响应3 <=====

同一个连接，多个请求/响应交叉传输，互不阻塞
```

- **解决了 HTTP/1.1 的队头阻塞**：不同请求的帧可以交错，丢帧只影响该流
- 但：**TCP 队头阻塞依然存在**：如果 TCP 层丢包，所有流都要等重传

### HPACK（Header 压缩）

```
静态表（常用 header）：
:method: GET  -> 索引 2
:scheme: https -> 索引 6
:path: /     -> 索引 4
host:       -> 索引 54

动态表（当前请求中重复的值）：
第一次请求: host:example.com (添加到动态表)
第二次请求: 索引54 + 动态表索引 (引用，不重复发)

增量传输，不重复
```

- **解决了 Header 重复的问题**：静态表 + 动态表，header 大幅缩小
- 索引引用，而不是每次完整发送

### Server Push

```
服务端主动推送资源：
客户端请求 HTML
服务端知道 CSS/JS 会被 HTML 引用
--> 主动 push CSS/JS（不用等客户端发现再请求）
```

- **但实际很少用**：客户端可以控制是否接收、是否取消
- 实践中：Preload 标签 + HTTP/2 Server Push 但推送依赖不准确

### 流控制（Flow Control）

```
每个流有独立的流控制窗口
服务端可以告诉客户端："我只能处理 X 字节"
避免服务端发太快压垮客户端
```

## HTTP/2 的问题

### TCP 队头阻塞

```
流1: [帧1-1][帧1-2][帧1-3][帧1-4][帧1-5]...
流2: [帧2-1][帧2-2][帧2-3][帧2-4][帧2-5]...

TCP 层丢包：包3丢了
HTTP/2 帧交织：
[1-1][2-1][1-2][3-1][1-3][2-2][1-4][2-3][1-5][2-4]...
包3 = 帧1-3 的一部分
--> 帧1-3 需要重传，所有后续帧等待
```

- **HTTP/2 解决了应用层队头阻塞（请求级别）**
- **但没有解决 TCP 队头阻塞（帧级别）**
- 在高丢包率网络（如移动网络）下，性能可能不如 HTTP/1.1

### 握手延迟

```
TCP 三次握手（1 RTT）
TLS 1.2 握手（2 RTT）
HTTP 请求（1 RTT）
---------------
总计：3 RTT（TLS 1.2）才能开始传输数据

HTTP/1.1 有 Keep-Alive：省去握手，但还是要 TLS
```

### 头部压缩的安全问题

- HPACK 静态表和动态表可以被压缩信道攻击（CRIME、BREACH）
- 缓解：对敏感 header 做加密或随机化

## HTTP/3 (QUIC)

### QUIC 核心设计

```
HTTP/3 = HTTP/2 semantics + QUIC transport

HTTP/2:           [TCP] [TLS 1.2] [HTTP/2]
HTTP/3:           [UDP] [TLS 1.3] [HTTP/3]

QUIC = 多路复用 + 可靠传输 + 拥塞控制 + TLS（在用户态实现）
```

- **基于 UDP**：绕过 TCP 的队头阻塞（UDP 本身不保证顺序，也就没有队头阻塞）
- **QUIC 在用户态实现可靠传输**：丢帧只影响该帧所在的流，其他流不受影响
- **TLS 1.3 集成**：QUIC 的 TLS 握手和传输层握手合并，0-RTT 或 1-RTT

### HTTP/3 的优势

#### 1. 无 TCP 队头阻塞

```
流1: [帧1-1][帧1-2][帧1-3][帧1-4]
流2: [帧2-1][帧2-2][帧2-3][帧2-4]

QUIC 层丢包：
如果帧1-3 丢了：
- 流1 等待重传
- 流2 不受影响（QUIC 是流级独立确认）
```

- **每个流独立**：一个流的丢包不影响另一个流
- 这是 HTTP/3 相对于 HTTP/2 最大的改进

#### 2. 连接迁移（Connection Migration）

```
场景：手机从 WiFi 切换到 4G，IP 变了

TCP：连接绑定到 (src_ip, src_port, dst_ip, dst_port)
     IP 变了，连接必须重建（三次握手 + TLS）

QUIC：连接由 Connection ID 标识
      IP 变了，Connection ID 不变，连接继续
      ---> 0 RTT 恢复
```

- **移动网络体验提升**：切换网络不中断
- 对延迟敏感的场景（视频、游戏）收益最大

#### 3. 0-RTT / 1-RTT

```
TLS 1.3 0-RTT：
客户端已知服务端公钥（之前见过）
直接发加密数据 + 握手请求
服务端解密后直接处理请求

TLS 1.3 1-RTT：
ECDHE 密钥交换
客户端发 ClientHello + 密钥参数
服务端发 ServerHello + 证书 + 密钥参数
双方计算出密钥
--> 1 RTT 完成密钥交换
```

- HTTP/3 + TLS 1.3 可以 0-RTT 或 1-RTT 发起请求
- HTTP/1.1 + TLS 1.2 需要 3 RTT
- **差距：从 3 RTT -> 1 RTT 或 0 RTT**

### HTTP/3 的问题

1. **UDP 性能问题**：
   - 有些网络设备（防火墙、NAT）会丢 UDP 包或限速
   - QUIC 可能需要降级到 HTTP/2
2. **服务器资源**：
   - QUIC 需要在用户态实现，CPU 开销比内核 TCP 栈高
   - 早期部署成本高
3. **抓包分析更复杂**：
   - tcpdump 只能看到 UDP，要用 Wireshark + QUIC 插件

## 对比总结

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| 传输层 | TCP | TCP | UDP (QUIC) |
| Multiplexing | 无 | 有（流） | 有（流，独立） |
| 队头阻塞 | 请求级 | 请求级解决，TCP 级未解决 | 完全解决 |
| Header 压缩 | 无 | HPACK | QPACK |
| Server Push | 无 | 有 | 有（改进） |
| TLS 握手 | 1 RTT (1.3) | 2 RTT (1.2) | 1 RTT (1.3) / 0 RTT |
| 连接迁移 | 不支持 | 不支持 | 支持 |
| 握手延迟 | 1 RTT + TLS | 3 RTT | 1 RTT |
| 复杂度 | 低 | 中 | 高 |
| 兼容网络 | 最好 | 好 | 差（UDP 丢包） |

## L2：协议实现细节与边界

### HPACK 与 QPACK 对比

| 特性 | HPACK (HTTP/2) | QPACK (HTTP/3) |
|---|---|---|
| 动态表更新 | 顺序依赖（丢包会阻塞后续 header 解码） | 独立流（Out-of-band 更新，不阻塞） |
| 索引大小 | 4KB（默认） | 可变，通常更大 |
| 压缩率 | 高（但存在 CRIME/BREACH 风险） | 高，且消除了 Hol 阻塞风险 |

QPACK 的改进：HTTP/3 中 header 压缩表的更新通过独立的 **Encoder Stream / Decoder Stream** 传输，不混在数据流中，因此不会受到流级丢包的影响。

### 0-RTT 与重放攻击

```
TLS 1.3 0-RTT:
  Client -> Server: ClientHello + early_data(encrypted GET /balance)
  Server -> Client: ServerHello + 处理请求

风险：
  - 攻击者截获 early_data 包，重放给服务器
  - 如果请求是 GET /balance（幂等），重放无害
  - 如果请求是 POST /transfer?to=attacker&amount=1000，重放会造成重复转账

缓解：
  - 服务器端实现 anti-replay（存储已处理的 0-RTT nonce）
  - 限制 0-RTT 只用于幂等、无副作用的请求
```

### 边界陷阱

1. **HTTP/2 Server Push 已废弃**：Chrome 106+ 已移除对 HTTP/2 Server Push 的支持，推荐用 `103 Early Hints` 或 Preload 替代。
2. **HTTP/3 的 UDP 被中间件限速**：某些企业防火墙、QoS 策略对 UDP 限制比 TCP 更严格，导致 HTTP/3 实际可用带宽更低。
3. **HTTP/2 的流控可能饿死小流**：如果某个流窗口被耗尽，即使其他流有数据也无法发送，需要合理设置 `SETTINGS_INITIAL_WINDOW_SIZE`。

## L3：可运行实验

见 `impl/http_lab/`：

```bash
cd systems-engineering/computer-networking/impl/http_lab
python3 http_simulator.py
```

脚本模拟：
- HTTP/1.1：串行请求，总耗时 = 所有请求之和
- HTTP/2：多路复用，但 TCP 丢包会惩罚所有流（HoL）
- HTTP/3：流级独立，一个流丢包不影响其他流

## 核心追问

1. **HTTP/2 的 multiplexing 解决了什么？** 解决了 HTTP/1.1 请求级别的队头阻塞（一个请求等，另一个不能发）
2. **HTTP/2 解决了 TCP 队头阻塞吗？** 没有解决，TCP 层丢包仍然阻塞所有流
3. **HTTP/3 为什么用 UDP？** UDP 没有连接建立时握手，无队头阻塞；QUIC 在用户态实现可靠传输、拥塞控制、TLS
4. **为什么 HTTP/3 在高丢包网络下比 HTTP/2 好？** 因为 QUIC 的流级确认：一个流丢包只阻塞该流，其他流不受影响
5. **0-RTT 的安全考虑？** 0-RTT 可能受到重放攻击，适用于幂等请求（GET），不适用于 POST/写操作

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| TCP deep dive | L2+L3 | done |
| HTTP versions comparison | **L2+L3** | **done** |
| TLS handshake walkthrough | L1 | todo |
| network troubleshooting playbook | L1 | todo |