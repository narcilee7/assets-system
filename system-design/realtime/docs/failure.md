# Failure Mode

## F1: 连接风暴（Connection Storm）

### 场景

| 场景 | 表现 | 根因 |
|------|------|------|
| 服务器发布事件 | 10W 用户的房间有人发消息，所有用户同时响应 | 消息推送触发客户端批量操作 |
| 热点事件 | 某明星发布动态，100W 用户同时涌入 | 事件驱动的大量连接同时建立 |
| 故障恢复后 | 服务重启，所有用户同时重连 | 集中重连 |
| 心跳超时后 | 10W 连接同时断开，然后同时重连 | 心跳策略没有错峰 |

### 影响

- 大量 TCP 连接同时建立 → 服务器连接数瞬间打满
- 大量 Redis 请求同时发生 → Redis CPU/内存激增
- 大量 MySQL 查询 → 数据库连接池耗尽

### 应对策略

#### 1. 连接限流（保护服务器）

```
同时建立连接的用户数超过阈值时，触发排队机制：
  - 向客户端返回 "连接排队中，请稍候"
  - 每秒放行 N 个连接（rate limit）
  - 队列满时拒绝新连接（503 Service Unavailable）

公式：每秒放行数 = 服务器最大连接数 / 用户期望最长等待时间
例如：服务器 10W 连接 → 每秒放行 1000 → 最多等 100s
```

#### 2. 心跳随机 jitter（防止同时断开）

```go
// 心跳间隔加随机抖动，避免所有连接同时超时
interval := 15*time.Second + time.Duration(rand.Int63n(5000))*time.Millisecond
// 15s ~ 20s 随机心跳间隔
// 不同节点的连接在不同时间点超时，避免集中断开
```

#### 3. 重连退避（防止集中重连）

```
指数退避 + 随机 jitter：
  reconnect_delay = min(initial_delay * 2^attempts + jitter, max_delay)

例如：initial=1s, max=30s
  - 第 1 次：1s + 0~1s jitter = 1~2s
  - 第 2 次：2s + 0~2s jitter = 2~4s
  - 第 3 次：4s + 0~4s jitter = 4~8s
  ...
  - 第 5 次：16s + 0~16s jitter = 16~32s → 限制在 30s

这样 10W 用户重连，不会都在同一秒，而是分散在几秒到几十秒内
```

#### 4. 热点房间分散

```
热点事件（明星直播）时：
  - 将用户分散到多个房间（room-1, room-2, ..., room-n）
  - 消息只发到主房间，通过广播复制到其他房间
  - 避免单房间订阅者过于集中
```

---

## F2: 消息丢失（Message Loss）

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 客户端网速慢 | 消息到达客户端但未能 ACK | 服务端以为未送达 |
| 服务器重启 | 内存中未持久化的消息丢失 | 消息彻底丢失 |
| 网络抖动 | 消息在传输途中丢失 | 双方都不知道 |
| 消息缓冲溢出 | 客户端接收缓冲区满，新消息被丢弃 | 最新消息丢失 |

### 诊断

```
用户反馈："我发了一条消息，对方说没收到"
  │
  ├── 检查服务端消息表：消息 mid 是否存在？
  │    ├── 不存在 → 客户端没发出来（网络问题）
  │    └── 存在但 status=pending → 未送达
  │
  └── 检查客户端发送记录：客户端有发送记录吗？
       ├── 没有 → 客户端实际没发出去
       └── 有 → 服务端收到了但没送达
```

### 应对策略

#### 1. 消息持久化 + ACK 机制

```
消息发送流程：
  1. 消息先持久化到 MySQL（status=pending）
  2. 投递给客户端
  3. 客户端收到后回 ACK
  4. 服务端收到 ACK → status=delivered

如果 30s 内没收到 ACK：
  - 保留消息为 pending（待补发）
  - 用户上线时补发 pending 消息
```

#### 2. 消息重发（客户端侧）

```go
// 客户端每 5s 检查是否有消息未 ACK
func (c *Client) CheckPendingMessages() {
    for mid, msg := range c.pendingMessages {
        if time.Since(msg.sentAt) > 5*time.Second {
            // 重发该消息
            c.Resend(msg)
        }
    }
}
```

#### 3. 服务端消息缓冲（防止重启丢失）

```
消息到达 → 先持久化到 MySQL → 再投递
（不能先投递再持久化，更不能只存内存）

即使服务器重启，已持久化的消息不会丢失
```

#### 4. TCP 层重传（WebSocket 层面）

```
WebSocket 基于 TCP，TCP 自身有重传机制
但 TCP 重传只能保证数据链路层的可靠传输
不能保证应用层的"消息已被客户端接收"

因此需要应用层的 ACK 机制
```

---

## F3: 消息乱序（Message Reordering）

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 网络抖动 | 部分消息包延迟，后发的消息先到达 | 对话顺序混乱 |
| 重连补发 | 补发的消息和后续消息顺序不一致 | 历史消息和实时消息混合 |
| 多设备登录 | 同一用户在不同设备上收到消息顺序不同 | 多端消息不同步 |

### 影响

```
用户 A 发消息：
  M1: "你好" （网络慢，延迟 5s）
  M2: "我叫张三"

用户 B 收到顺序：
  1. M2 "我叫张三"
  2. M1 "你好"

结果：显示为 "我叫张三 你好"（逻辑错乱）
```

### 应对策略

#### 1. 消息 seq 排序（强制顺序）

```
每条消息带 seq（房间内严格递增）
客户端收到消息后，按 seq 排序展示

客户端本地维护一个排序队列：
  - 收到消息：按 seq 插入正确位置
  - 显示时从队列头部依次取出
```

#### 2. 乱序检测与告警

```go
func (q *MessageQueue) Add(msg *Message) {
    expectedSeq := q.lastSeq + 1
    if msg.Seq > expectedSeq {
        // 收到跳过 seq 的消息，说明中间有消息在途或丢失
        log.Warn("message gap detected", "expected", expectedSeq, "got", msg.Seq)
        // 等待 2s，看是否有补发
        // 超时后按当前顺序显示（允许小乱序）
    }
    if msg.Seq < q.lastSeq {
        // 收到更早的消息（补发），放到正确位置
    }
    q.lastSeq = msg.Seq
}
```

#### 3. 多设备同步（多端一致性）

```
每条消息有全局唯一 mid
多端各自维护自己的消息列表（按 mid 去重）
每端按 ts 排序（不是到达顺序）

新设备登录时：
  - 获取该用户在所有房间的消息
  - 按 mid 去重后，按 ts 排序展示
  - 解决多端消息顺序不一致问题
```

---

## F4: 流式输出中断（Stream Interruption）

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 客户端断连 | 用户断网，Agent 流式输出中断 | 输出结果丢失 |
| 网络抖动 | 流数据传输中断 | 部分 token 丢失 |
| Agent 服务故障 | LLM 服务崩溃 | 流输出终止，结果不完整 |

### 应对策略

#### 1. 消息缓冲 + 恢复

```go
// 服务端：每个 token 都写入 Redis 缓冲
func (stream *Stream) OnToken(token string) {
    stream.buffer = append(stream.buffer, token)

    // 发送到客户端
    stream.Send(&Message{
        Type: "stream_data",
        Content: token,
    })

    // 每 10 个 token 刷一次盘（防止崩溃丢失太多）
    if len(stream.buffer)%10 == 0 {
        go stream.PersistBuffer()
    }
}

// 客户端断连重连后
func (client *Client) ResumeStream(streamID string) {
    // 从 Redis 获取已缓冲的内容
    buffer := client.redis.LRange("stream:"+streamID+":buffer", 0, -1)

    // 补发已缓冲的内容（从 seq=1 开始）
    for i, token := range buffer {
        client.Send(&Message{
            Type: "stream_data",
            StreamID: streamID,
            Content: token,
            Seq: i + 1,
            IsRecovery: true,  // 标记为恢复数据
        })
    }
}
```

#### 2. 流状态持久化

```
流任务表：
  - stream_id, status, output_length, ended_at
  - 每次 token 到来更新 output_length
  - 即使服务崩溃，重启后能查到流的状态

客户端重连后：
  - 查询流状态
  - 如果 completed：返回完整结果
  - 如果 streaming：继续获取 buffer + 接收新 token
```

---

## F5: 内存泄漏（Long Connection Memory Leak）

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 连接断开但未清理 | 客户端异常断开，服务器未收到通知 | 连接对象持续占用内存 |
| 消息队列无上限 | 离线消息队列无限增长 | 内存耗尽 |
| 订阅关系未清理 | 用户离开房间，但 Redis/内存未移除 | 数据不一致 + 内存泄漏 |

### 诊断

```
运维发现：
  - 网关内存从 500MB 增长到 8GB
  - 没有 OOM 但性能持续下降

诊断：
  - 查看连接数：是否有 10W 连接但 Redis 显示 5W？
    → 部分连接断开但未从本地清理
  - 查看消息队列大小：某用户离线消息是否有 100W 条？
    → 队列无上限
```

### 应对策略

#### 1. 连接超时强制清理

```go
// 每分钟扫描所有连接，清理超时连接
func (mgr *ConnectionManager) CleanupStaleConnections() {
    now := time.Now().Unix()
    mgr.byConnID.Range(func(connID, conn interface{}) bool {
        c := conn.(*Connection)
        if now - c.LastHeartbeatAt > 60 {  // 60s 超时
            mgr.RemoveConnection(connID)
            log.Warn("removed stale connection", "connID", connID)
        }
        return true
    })
}
```

#### 2. 消息队列上限

```go
const (
    MaxOfflineQueueSize = 1000  // 每用户最多 1000 条离线消息
)

func (q *OfflineQueue) Enqueue(msg *Message) {
    if q.Size() >= MaxOfflineQueueSize {
        // 超过上限，移除最老的
        q.Dequeue()
    }
    q.InnerQueue.Enqueue(msg)
}
```

#### 3. 订阅关系一致性校验

```
Redis 订阅关系和本地内存订阅表必须一致

定期校验（每 5 分钟）：
  - Redis 房间成员列表 vs 本地订阅表
  - 差异记录告警
  - 自动清理孤儿数据
```

---

## F6: Redis 不可用（连接状态丢失）

### 场景

| 场景 | 影响 | 恢复 |
|------|------|------|
| Redis 单节点故障 | 用户连接状态丢失，新消息无法路由 | 降级到本地状态 |
| Redis Cluster 分片故障 | 部分用户连接状态丢失 | 切换到备用分片 |
| Redis 内存打满 | 连接状态写入失败，新用户无法连接 | 扩容或清理过期 key |

### 降级策略

#### 1. 本地缓存降级

```
Redis 不可用时：
  1. 切换到节点本地连接表（只读，不更新）
  2. 新连接请求：降级拒绝（503 Service Unavailable）
  3. 已连接用户：正常服务

Redis 恢复后：
  1. 全量同步本地连接表到 Redis
  2. 恢复路由功能
```

#### 2. 消息暂存降级

```
Redis 不可用时：
  - 消息不能通过 Redis 路由到其他节点
  - 只能发送给本地节点的用户
  - 跨节点消息需要等 Redis 恢复

这会导致跨节点消息短暂延迟，但不会丢失（消息还在 MySQL）
```

---

## F7: 分区（Network Partition）

### 场景

```
Node-1 和 Node-2 之间网络断开
  ├── 房间 R 的成员分布在两个节点上
  ├── Node-1 上的用户 A 发消息
  ├── 消息只发到了 Node-1 的成员
  └── Node-2 上的成员收不到消息
```

### 应对策略

#### 1. 跨节点消息队列

```
即使网络分区，消息也要发送到消息队列（Kafka）
  - Node-1 将消息发到 Kafka Topic：room-R-messages
  - Kafka 跨分区复制，消息不会丢失
  - Node-2 从 Kafka 消费消息（需要等网络恢复或 Kafka 自动恢复）
```

#### 2. 最终一致性

```
分区期间：
  - 各节点各自服务本地用户
  - 消息缓存在 Kafka

分区恢复后：
  - Kafka 自动补发分区期间的消息
  - 各节点补发消息给本地用户
  - 最终所有用户都能收到所有消息（可能有延迟）
```

---

## F8: 心跳超时误判

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 客户端 CPU 忙 | 客户端主线程阻塞，无法及时回 Pong | 正常连接被误判为断连 |
| GC 停顿 | Go GC 导致延迟 > 45s | 正常连接被误判 |
| 网络延迟 | 正常网络延迟，但 P99 > 45s | 偶发误判 |

### 应对策略

#### 1. 多次探测

```go
// 不要一次超时就判定断连，连续 3 次超时再断开
type HeartbeatState struct {
    missedCount int
    maxMissed   int = 3
}

func (s *HeartbeatState) OnMissed() {
    s.missedCount++
    if s.missedCount >= s.maxMissed {
        // 连续 3 次超时才判定断连
        s.Close()
    }
}

func (s *HeartbeatState) OnPong() {
    s.missedCount = 0  // 收到 Pong 就重置
}
```

#### 2. 动态超时

```
心跳超时根据历史延迟动态调整：
  - 过去 10 分钟 P99 延迟 = 10s
  - 超时阈值 = P99 * 3 = 30s
  - 比固定 45s 更合理（既能检测断连，又不会误判）
```

---

## F9: WebSocket 升级失败

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 代理不支持 Upgrade | 企业网络中经过的代理不支持 WebSocket 升级 | 连接失败 |
| ALB 超时 | AWS ALB 4 分钟无流量断开 | 长连接实际不存在 |
| 防火墙阻断 | 企业防火墙阻断 WebSocket 端口 | 连接失败 |

### 应对策略

#### 1. 多协议降级

```
连接流程：
  1. 客户端先尝试 WebSocket
  2. 握手失败（返回错误）
  3. 降级到 SSE
  4. SSE 也失败
  5. 降级到 Long Polling

代码示例：
  conn, err := websocket.Dial(url)
  if err != nil {
      // 尝试 SSE
      conn, err = sse.Dial(url)
      if err != nil {
          // 最后降级到 Long Polling
          conn, err = longpolling.Dial(url)
      }
  }
```

#### 2. ALB 超时配置

```
AWS ALB 超时配置：
  - 建议设为 3600s（1 小时）
  - 同时在应用层保持心跳（15-30s 间隔）
  - 即使 ALB 有超时限制，心跳能保持连接活跃
```

#### 3. 心跳保活

```
心跳不仅检测连接存活，还能保持中间设备（NAT、代理、ALB）的连接活跃
心跳间隔必须 < 中间设备的最短超时时间

建议：
  - 心跳间隔：15s（大多数 NAT 超时为 60s+）
  - 心跳超时：45s（连续 3 次 Ping 无响应）
```

---

## F10: 消息重复送达（Duplicate Delivery）

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 客户端重连重发 | 客户端没收到 ACK，认为消息丢失，主动重发 | 重复消息 |
| 服务端重试 | 服务端没收到 ACK，多次重发 | 重复消息 |
| 网络重传 | TCP 重传导致同一消息收到多次 | 重复消息 |

### 应对策略

#### 1. 客户端去重

```go
type MessageDedupe struct {
    receivedIDs map[string]bool  // mid → true
    maxSize    int = 10000
}

func (d *MessageDedupe) IsDuplicate(mid string) bool {
    if d.receivedIDs[mid] {
        return true  // 已收到，直接丢弃
    }
    d.receivedIDs[mid] = true

    // 超过上限，清理最老的
    if len(d.receivedIDs) > d.maxSize {
        // 清理一半（简单策略）
        for k := range d.receivedIDs {
            delete(d.receivedIDs, k)
            if len(d.receivedIDs) <= d.maxSize/2 {
                break
            }
        }
    }
    return false
}

// 收到消息时
if dedupe.IsDuplicate(msg.MID) {
    return  // 丢弃重复消息
}
// 处理消息...
```

#### 2. 幂等消息 ID

```
消息 ID 使用 Snowflake 生成，保证全局唯一
客户端按 mid 去重，不会出现同一消息处理两次

注意：幂等性需要业务层配合
  - 如果业务本身不是幂等的（如扣款），即使收到一次消息也不能重复处理
  - 需要在业务层做幂等检查（如检查已处理的 mid 列表）
```

#### 3. 服务端消息状态

```
消息有状态：pending → delivered → read
同一 mid 的消息只会有一个
如果已 delivered，再次发送给同一用户时，服务端检查后直接返回"已送达"
```
