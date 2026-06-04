# Scale

## 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 同时在线连接数 | 100W+ | 单节点 |
| 消息延迟（P99） | < 100ms | 端到端延迟（发送→送达）|
| 消息送达率 | 99.9% | 含重连补发 |
| 断连恢复时间 | < 3s | 断线重连到收到消息 |
| 心跳间隔 | 15s | 检测连接存活 |
| 系统可用性 | 99.95% | 连接管理服务必须高可用 |
| 流式输出延迟 | < 50ms | Agent 场景，每个 token 的延迟 |

---

## 性能瓶颈分析

### 瓶颈 1：长连接内存占用

#### 问题

每个 WebSocket 连接在服务端占用约 2-5KB 内存（连接对象 + 读写缓冲区）。

100W 连接 × 5KB = **5GB 内存**（仅连接本身，还不含消息缓冲）

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **共享连接对象池** | 连接对象复用，减少 GC | 内存降低 30% |
| **减小缓冲区大小** | 按需扩缩，而非预分配大缓冲区 | 内存降低 20% |
| **压缩元数据** | 字段压缩（如 user_id 用 int 而非 string）| 内存降低 15% |
| **定期 GC** | 手动触发 GC，避免内存碎片 | 内存稳定 |
| **连接状态外置** | 热数据放 Redis，冷数据放磁盘 | 单节点内存降低 |

#### 内存估算公式

```
单节点内存 = 连接对象内存 + 消息缓冲内存 + 路由表内存

连接对象内存 ≈ 2KB/连接
  - Connection struct：~1KB
  - Read/Write Buffer：~512B each
  - 元数据：~512B

100W 连接 × 2KB = 2GB

消息缓冲内存 ≈ 每连接 10KB（用于重连补发）
100W 连接 × 10KB = 10GB

总计 ≈ 12GB/节点
```

---

### 瓶颈 2：消息广播性能

#### 问题

用户 A 在 100W 成员的房间发消息，需要将消息推送给 100W 人。

如果每条消息遍历 100W 连接，时间复杂度 O(N)，不可接受。

#### 优化方案

##### 方案 A：房间分片（按节点分片）

```
将大房间拆分成多个子房间，成员分散在不同节点

房间 R 有 100W 成员
  → 拆分成 room-R-001 ~ room-R-100
  → 每子房间 1W 成员，分布在 10 个节点
  → 每节点只负责 1W 连接的消息广播

问题：同一房间不同子房间之间消息如何同步？
  → 广播层作为聚合节点，统一分发
```

##### 方案 B：分布式广播（Pub/Sub 分层）

```
Level 1：节点内广播（本地连接）
  - 消息只在本节点内广播到本地连接
  - O(本节点连接数)

Level 2：跨节点广播（Redis Pub/Sub）
  - 跨节点的消息通过 Redis 发布
  - 每个节点订阅自己负责的消息
  - O(节点数) 而非 O(连接数)

总复杂度：O(max(本节点连接数, 节点数))
```

##### 方案 C：广播优化（批量写入）

```
不逐个连接写入，而是批量写入：

原始：for conn in room_connections { conn.Write(msg) }  // 100W 次写入

优化：使用 WriteBatch 批量写入
  - 按连接分批（每批 1000 个）
  - 每批用一次系统调用写入所有连接
  - 100W 连接 = 1000 批 = 1000 次系统调用

效果：系统调用从 100W 次降到 1000 次（1000x 提升）
```

---

### 瓶颈 3：Redis 连接状态访问

#### 问题

每条消息发送前，需要查询用户当前连接的节点（Redis GET）。

100W QPS × 1 次 Redis GET = Redis 成为瓶颈。

#### 优化方案

##### 方案 A：本地热缓存

```
热点用户（高活跃度）的连接信息缓存在本地节点

缓存策略：
  - 用户发消息 → 缓存该用户到本地
  - 访问时先查本地，再查 Redis
  - 缓存 TTL = 30s，超时后失效

命中率：
  - 热点用户（高活跃度）≈ 20% 的用户产生 80% 的消息
  - 本地缓存命中率 ≈ 70-80%
  - Redis QPS 从 100W 降到 20-30W
```

##### 方案 B：连接信息内嵌消息

```
当用户 A 向用户 B 发消息时，消息中直接带上目标节点信息：

消息格式：
  {
    "mid": "msg-xxx",
    "to_user": "user-B",
    "to_node": "node-03"  // A 之前缓存的 B 的节点信息
  }

如果 to_node = 当前节点 → 直接发送
否则 → 发到 Redis Pub/Sub → 目标节点接收

这样只需要首次发消息时查 Redis，后续直接路由
```

##### 方案 C：Redis Pipeline / Cluster

```
Redis 单节点不够 → Redis Cluster 分片

分片策略：
  - 按 user_id hash 分片（而非按连接 key）
  - 同一用户的所有 key 在同一分片
  - 减少跨分片操作

Redis Cluster 配置：
  - 至少 6 节点（3 主 3 从）
  - 每主节点 32GB 内存
  - 支持 ~30W QPS
```

---

### 瓶颈 4：流式输出的 token 推送

#### 问题

Agent 流式输出场景，每个 token 需要立即推送给客户端。

如果 token 生成速度（50 tokens/s）> 推送速度，可能造成积压。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **零拷贝写入** | 避免 JSON 序列化，直接写入 buffer | 延迟降低 30% |
| **批量缓冲** | 每 5-10 个 token 合并一个帧发送 | 减少帧数量，降低协议 overhead |
| **异步推送** | Token 生成和推送解耦（Channel 通信）| 防止客户端慢导致 token 生成阻塞 |
| **连接优先级** | 流式输出连接优先处理 | 防止被普通消息阻塞 |

#### 异步流推送模型

```go
type Stream struct {
    tokenChan <-chan string
    conn      *Connection
    buffer    []string
}

func (s *Stream) Start() {
    go func() {
        for token := range s.tokenChan {
            s.buffer = append(s.buffer, token)

            // 累积 5 个 token 或 20ms 超时，批量发送
            if len(s.buffer) >= 5 || s.shouldFlush() {
                s.flushBuffer()
            }
        }
        // 最后不足一批的也发送
        s.flushBuffer()
    }()
}

func (s *Stream) flushBuffer() {
    if len(s.buffer) == 0 {
        return
    }
    s.conn.WriteMessages(s.buffer)
    s.buffer = s.buffer[:0]
}
```

---

### 瓶颈 5：心跳的 CPU 开销

#### 问题

10W 连接 × 每 15s 一次心跳 = 每秒 6600 次心跳帧写入。

如果是 WebSocket Ping 帧还好，如果是 SSE 心跳（JSON 文本），CPU 开销不小。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **心跳批次处理** | 批量发送心跳，每批 1000 个 | 减少系统调用 |
| **心跳事件合并** | 多个连接的心跳合并为一个系统调用（writev）| CPU 降低 50% |
| **Piggyback 消息** | 将心跳和数据消息合并发送，不单独发 | 减少消息数量 |
| **TCP Keepalive** | 使用操作系统层的 keepalive，替代应用层心跳 | CPU 降低 70%（但检测时间长）|

---

## 扩展方案

### 扩展维度 1：水平扩展（多节点）

```
                    ┌─────────────────────┐
                    │   Load Balancer      │
                    │  (L4 或 DNS RR)      │
                    └──────────┬──────────┘
                               │ 路由（按 user_id hash）
    ┌──────────────────────────┼──────────────────────────┐
    ▼                          ▼                          ▼
┌─────────┐              ┌─────────┐              ┌─────────┐
│ Node-1  │              │ Node-2  │              │ Node-3  │
│ 10W 连接 │              │ 10W 连接 │              │ 10W 连接 │
└─────────┘              └─────────┘              └─────────┘
    │                          │                          │
    └──────────────────────────┼──────────────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │   Redis Cluster      │
                    │  (连接状态 + 路由)  │
                    └─────────────────────┘
```

**路由策略**：
- 最简单：按 user_id 的 hash % 节点数（静态路由）
- 推荐：一致性 hash（节点变更时影响范围小）

**最大节点数受限于**：
- Redis Pub/Sub 的 fan-out 能力
- Load Balancer 的健康检查能力
- 通常 50-100 节点足够

### 扩展维度 2：多地域部署

```
Region CN（北京）
  ├── 边缘节点 1（用户段 1-1000W）
  ├── 边缘节点 2（用户段 1000W-2000W）
  └── 中心节点（跨地域消息转发）

Region SG（新加坡）
  ├── 边缘节点 3（用户段 2000W-3000W）
  └── 边缘节点 4（用户段 3000W-4000W）

跨地域消息：
  用户 A（CN）发消息给用户 B（SG）
  → 消息先到 CN 中心节点
  → 中心节点转发到 SG 边缘节点
  → SG 边缘节点投递给用户 B

跨地域延迟：~50-100ms（CN ↔ SG）
```

---

## 容量规划

### 连接数容量

```
目标：支持 100W 用户同时在线（每人 1 个设备）

单节点容量：10W 连接
所需节点数：10 个节点（冗余 2 个 = 12 个）

节点配置建议：
  - CPU：32 核
  - 内存：64GB（12GB 用于连接 + 52GB 用于缓冲）
  - 网络：10Gbps
  - SSD：用于日志和消息缓冲
```

### 消息吞吐量容量

```
目标：峰值 10W QPS（每秒 10W 条消息）

消息大小：平均 1KB
带宽需求：10W × 1KB = 100GB/s = 800Gbps（超出单节点能力）

优化：压缩消息（gzip/snappy）
  - 压缩率：50-70%
  - 实际带宽：300-400Gbps（仍需多节点分散）

节点数计算：
  每节点带宽处理能力：1Gbps
  所需节点数：4-5 个节点（用于消息处理）
```

### Redis 容量

```
连接状态 key：100W × 200 bytes = 200MB
房间成员列表：按实际订阅数（平均每用户 5 个房间）
  100W × 5 × 100 bytes = 500MB

总计：~1GB（远小于 Redis 单节点容量）

QPS 估算：
  每条消息 1-2 次 Redis 读（查用户节点）
  10W QPS 消息 × 2 = 20W Redis QPS
  Redis Cluster 可支持 30-50W QPS
```

---

## 监控指标

### 核心指标

```
# 连接相关
realtime.connections.active                    # 当前活跃连接数
realtime.connections.total                     # 历史累计连接数
realtime.connections.new_rate                  # 新建连接速率（每秒）
realtime.connections.close_rate                # 关闭连接速率（每秒）
realtime.connections.by_type                   # 按类型分布（websocket/sse/longpolling）

# 消息相关
realtime.messages.sent_total                   # 发送消息总数
realtime.messages.sent_rate                    # 消息发送速率（每秒）
realtime.messages.delivered_rate               # 消息送达速率（每秒）
realtime.messages.ack_rate                     # ACK 确认速率（每秒）
realtime.messages.lost_rate                     # 消息丢失率
realtime.messages.duplicate_rate                # 重复消息率

# 延迟相关
realtime.message.delivery.latency_p99_ms        # 消息投递延迟 P99
realtime.heartbeat.latency_p99_ms              # 心跳响应延迟 P99
realtime.reconnect.time_ms                     # 重连恢复时间

# 流相关
realtime.streams.active                        # 当前活跃流数量
realtime.streams.token_rate                    # Token 流速率（每秒）

# 资源相关
realtime.memory.bytes                         # 连接内存占用
realtime.node.connections                      # 本节点连接数
```

### 告警阈值

| 指标 | 警告 | 严重 |
|------|------|------|
| 活跃连接数 | > 80% 容量 | > 95% 容量 |
| 消息丢失率 | > 0.5% | > 1% |
| 重连恢复时间 | > 5s | > 10s |
| 消息投递延迟 P99 | > 200ms | > 500ms |
| 消息重复率 | > 1% | > 5% |
| 节点连接数不均衡 | > 20% 差异 | > 50% 差异 |
| Redis QPS | > 80% 容量 | > 95% 容量 |
| 流式输出 token 积压 | > 100 tokens | > 500 tokens |
