# TCP Deep Dive

## 目标

深入理解 TCP 协议：状态机、三次握手/四次挥手、TIME_WAIT、滑动窗口、重传机制、拥塞控制。

## 场景

- 连接建立失败，定位在三次握手的哪一步
- TIME_WAIT 堆积，优化 tcp_tw_reuse / net.ipv4.tcp_fin_timeout
- 网络延迟高，分析 RTT 和重传率
- 队头阻塞：HTTP/2 的 multiplexing 解决了什么问题，又带来什么新问题
- 连接复用：keep-alive vs pipeline vs HTTP/2 multiplexing

## TCP 状态机

```
CLOSED
   |  passive open
   v
LISTEN
   |  <- SYN
   v
SYN_SENT
   |  -> SYN, ACK
   v
SYN_RECEIVED
   |  <- ACK
   v
ESTABLISHED <-------------------------> ESTABLISHED
   |  close                           |  close
   v                                  v
FIN_WAIT_1                        CLOSE_WAIT
   |  <- ACK (half-close)              |  <- FIN
   v                                  v
FIN_WAIT_2                        LAST_ACK
   |  <- FIN                            |  -> ACK
   v                                  v
TIME_WAIT                       CLOSED
   |  2MSL timeout
   v
CLOSED
```

**关键状态解释**：

| 状态 | 含义 | 常见问题 |
|---|---|---|
| LISTEN | 服务端等待连接 | backlog 溢出导致连接拒绝 |
| SYN_SENT | 客户端发了 SYN 等待 ACK | 网络丢包 / NAT 超时 |
| SYN_RECEIVED | 服务端收到 SYN/ACK | 半连接队列满 |
| ESTABLISHED | 连接正常 | — |
| FIN_WAIT_1 | 发 FIN 等 ACK | 对端不 ACK 导致挂起 |
| FIN_WAIT_2 | 收到 ACK 等对端 FIN | 对端崩溃 / 防火墙断流 |
| TIME_WAIT | 等 2MSL 才关闭 | 端口耗尽，无法新建连接 |
| CLOSE_WAIT | 收到 FIN 等本地 close | 程序没调用 close() |
| LAST_ACK | 发 FIN 等最终 ACK | — |

## 三次握手

```
Client                          Server
  |                               |
  |  -- SYN (seq=x) -->           |  客户端: 发 SYN，选 initial seq
  |                               |
  |  <-- SYN,ACK (seq=y, ack=x+1) |  服务端: 发 SYN+ACK，ack 确认
  |                               |
  |  -- ACK (ack=y+1) -->         |  客户端: 发 ACK，连接建立
  |                               |
  |     ESTABLISHED               |     ESTABLISHED
```

**为什么三次而不是两次？**

- 两次无法确认客户端的接收能力（Server 发 SYN，Client 不回 ACK，Server 不知道 Client 能不能收）
- 两次无法交换 initial sequence number（双方都需要知道对方的 ISN）
- **核心**：TCP 是全双工，每个方向都需要确认序号，所以至少需要 3 个包

**三次握手的问题**：

1. ** SYN 泛洪**：服务端在 SYN_RECEIVED 状态消耗资源，攻击者发大量 SYN 不完成握手
   - 防御：`tcp_syncookies`、`tcp_max_syn_backlog`、`SYN proxy`
2. ** 初始窗口小**：前 3 个包不能带应用层数据（HTTP），HTTP/1.1 只能等连接建立后才能发请求
   - 改善：HTTP/2 在同一连接上 multiplexing，HTTP/3 (QUIC) 0-RTT

**抓包验证**：
```bash
# 抓 SYN/SYN-ACK/ACK
tcpdump -i eth0 'tcp[tcpflags] & (tcp-syn|tcp-ack) != 0 and tcp[tcpflags] & (tcp-rst|tcp-fin) == 0' -nn

# 抓三次握手（SYN, SYN-ACK, ACK）
tcpdump -i eth0 'tcp[tcpflags] == tcp-syn' -nn
tcpdump -i eth0 'tcp[tcpflags] == (tcp-syn|tcp-ack)' -nn
tcpdump -i eth0 'tcp[tcpflags] == tcp-ack and tcp[4:4] = 1' -nn
```

## 四次挥手

```
Client                          Server
  |                               |
  |     ESTABLISHED               |     ESTABLISHED
  |                               |
  |  -- FIN (seq=u) -->           |  客户端: 发 FIN，进入 FIN_WAIT_1
  |                               |
  |  <-- ACK (ack=u+1) -->        |  服务端: 回 ACK，客户端进入 FIN_WAIT_2
  |                               |
  |  <-- FIN (seq=v) --           |  服务端: 处理完数据，发 FIN，进入 CLOSE_WAIT
  |                               |
  |  -- ACK (ack=v+1) -->         |  客户端: 回 ACK，进入 TIME_WAIT
  |                               |
  |     TIME_WAIT (2MSL)          |     CLOSE_WAIT -> LAST_ACK -> CLOSED
  |     (等待足够时间确保服务端收到)
  |                               |
  v
  CLOSED
```

**为什么挥手是四次而不是三次？**

- TCP 是全双工，两个方向各自独立关闭
- 客户端发 FIN 表示"我不再发送数据"，但服务端可能还在发送数据
- 服务端必须等应用层处理完（close() 调用），才能发 FIN
- 所以每个方向的 FIN 都需要单独的 ACK

**四次挥手的特殊情况**：

1. **同时关闭**（simultaneous close）：
```
Client                          Server
  -- FIN (seq=u) -->            <-- FIN (seq=v)
  <-- ACK (ack=u+1)              --> ACK (ack=v+1)
  TIME_WAIT                      TIME_WAIT
```
双方都进入 TIME_WAIT。

## TIME_WAIT

**什么是 TIME_WAIT？**

- 主动关闭方收到 FIN 并发 ACK 后，进入 TIME_WAIT
- 等待 2MSL（Maximum Segment Lifetime）才进入 CLOSED
- MSL 通常是 60 秒（Linux 默认 `net.ipv4.tcp_fin_timeout = 60`）

**为什么需要 TIME_WAIT？**

1. **确保对端收到最后的 ACK**：如果 ACK 丢失，对端会重发 FIN，TIME_WAIT 还没过期的客户端能重发 ACK
2. **让旧连接的重复报文过期**：否则，旧连接的包可能被新连接误收

**TIME_WAIT 引发的问题**：

- **端口耗尽**：客户端频繁建连（爬虫、负载均衡 client），本地端口从 32768 开始，最高 60999，共约 28000 个
- **解决**：`tcp_tw_reuse = 1`（复用 TIME_WAIT 连接）、`tcp_tw_recycle = 1`（快速回收，但不推荐 NAT 后使用）、调低 `tcp_fin_timeout`

**抓包验证**：
```bash
# 统计 TIME_WAIT 数量
ss -ant state time-wait | wc -l

# 查看每个 TIME_WAIT 的详细信息
ss -ant state time-wait -o

# 看 TIME_WAIT 持续时间
ss -ant state time-wait -e
```

## 滑动窗口

**为什么需要滑动窗口？**

- 原始停等协议（send 1 packet, wait ACK, send next）效率低
- 滑动窗口：允许连续发送多个包，窗口内不需要等 ACK

```
发送窗口 (假设大小=3)
[包1] [包2] [包3] [    ] [    ]
 已发   已发   可发   等待   未来

 ACK 包1 -> 窗口右移
[包1] [包2] [包3] [    ] [    ]
       已发   可发   等待   未来
```

**窗口大小**：
- **接收窗口**：告诉对方"我还能接收多少数据"，动态调整
- **拥塞窗口（cwnd）**：防止发送过快，超过网络容量
- **发送窗口** = min(接收窗口, 拥塞窗口)

**丢包时的行为**：
```
发送: 包1 包2 包3 包4 包5
      ACK ACK ACK (包3 丢失 -> 重传包3)
      包4 包5 等待包3 ACK 后才能确认
```

这就是 **队头阻塞（Head-of-Line Blocking）**：如果包3丢了，包4和包5虽然收到了也要等重传。

## 重传机制

### 超时重传（RTO）

```bash
# 查看当前 RTT 估算
cat /proc/sys/net/ipv4/tcp_rfc1337
# 0 = 遵循 RFC 1337 TIME_WAIT 处理

# 查看 RTO 计算参数
ip route show
# 或者
ss -i
```

- RTT 测量：每次发包记录时间，ACK 回来时计算 RTT
- RTO = RTT × multiplier（通常 1.5~3）
- RTO 太短：过早重传，造成冗余
- RTO 太长：丢包后等待时间长

### 快速重传（Fast Retransmit）

```
发送: 包1 包2 包3 包4 包5
      ACK ACK ACK (收到 3 个 ACK，表示包1/2/3 已到，包4可能丢了)
      --> 立即重传包4（不等 RTO 到期）
```

- **快速重传触发条件**：收到 3 个重复 ACK（ACK 确认的是同一个包）
- **解决的问题**：不需要等 RTO，能更快恢复

### 选择性确认（SACK）

- 原始 TCP：ACK 只能确认到最大连续收到的包，不能选择性确认
- SACK：告诉对方"我收到了包1，包3-5，但没收到包2"
- 发送方可以只重传包2，不用重传包3-5

```bash
# 查看 SACK 是否启用
cat /proc/sys/net/ipv4/tcp_sack
# 1 = 启用

# 抓包看 SACK 信息
tcpdump -i eth0 'tcp[40:4] > 0' -nn  # tcp[40:4] 是 SACK 选项的位置
```

## 拥塞控制

### 算法阶段

```
慢启动 (cwnd 指数增长)
  -> 直到 ssthresh (慢启动阈值)
  -> 拥塞避免 (cwnd 线性增长)
  -> 丢包 (ssthresh = cwnd/2, cwnd = 1)
  -> 快速恢复 (cwnd = ssthresh)
```

**Linux 拥塞控制算法**：
```bash
# 查看当前算法
sysctl net.ipv4.tcp_congestion_control

# 查看可用算法
sysctl net.ipv4.tcp_available_congestion_control

# 查看 cubic 算法参数
sysctl net.ipv4.tcp_congestion_control
# cubic 是默认算法
```

| 算法 | 特点 | 适用场景 |
|---|---|---|
| reno | 经典算法，慢启动+拥塞避免 | 简单网络 |
| cubic | 更平滑的拥塞响应，RTT fairness | 广域网 |
| bbr | 基于模型，不依赖丢包 | 高带宽高延迟 |
| vegas | 基于 RTT 变化检测拥塞 | 有一定基础 |

### BBR vs CUBIC

```
CUBIC: 丢包才减速（丢包=拥塞）
BBR:   RTT 增大就减速（更早发现拥塞）

在高带宽高延迟网络中：
- CUBIC 过度激进，周期性大降速
- BBR 更平稳，吞吐量更高

在丢包率高的网络中：
- BBR 可能过于敏感（RTT 抖动 ≠ 拥塞）
- CUBIC 更稳定
```

## 核心追问

1. **为什么三次握手不能带数据？** 带数据的话可能放大 SYN 泛洪攻击；且握手完成前没有拥塞控制窗口
2. **TIME_WAIT 为什么是 2MSL？** 1MSL 让最后的 ACK 到达对端，1MSL 让旧连接的报文过期
3. **滑动窗口和拥塞窗口的区别？** 滑动窗口是接收方告诉发送方"我还能收多少"，拥塞窗口是发送方自己估算"网络能承受多少"
4. **队头阻塞是 TCP 的问题还是 HTTP 的问题？** TCP 有队头阻塞（丢包导致后续包等待），HTTP/1.1 有队头阻塞（请求必须顺序响应），HTTP/2 解决了 HTTP 队头阻塞但没解决 TCP 队头阻塞，HTTP/3 (QUIC) 两者都解决
5. **快速重传和快速恢复的区别？** 快速重传：收到 3 个重复 ACK 就重传；快速恢复：重传后不进入慢启动，而是进入拥塞避免

## 复杂度

- 时间复杂度：O(n) — 每个状态转移 O(1)
- 空间复杂度：O(1) — 状态机是常量

## 工程迁移

- **高并发短连接**：调高 `tcp_tw_reuse`，或用连接池
- **长尾延迟**：分析 RTT 和重传率，`ss -i` 看 `rtt` 和 `retrans`
- **高吞吐**：启用 `tcp_window_scaling`，增大接收窗口

## 状态

| 资产 | 状态 |
|---|---|
| TCP deep dive | done |
| HTTP versions comparison | todo |
| TLS handshake walkthrough | todo |
| network troubleshooting playbook | todo |