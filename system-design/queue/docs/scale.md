# Scale

## 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 吞吐量 | > 10W QPS | 单队列 |
| 消息延迟 P99 | < 10ms | 端到端 |
| 消息持久性 | 99.9999% | 消息不丢失 |
| 系统可用性 | 99.99% | 队列服务本身 |
| 消费者线性扩展 | N 个消费者 = N 倍吞吐 | 水平扩展 |

---

## 性能瓶颈分析

### 瓶颈 1：磁盘 I/O

#### 问题

消息持久化需要写磁盘，磁盘 I/O 成为瓶颈。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **顺序写入** | WAL 追加写 | 磁盘吞吐最大化 |
| **SSD** | 使用 NVMe SSD | 随机读写性能提升 100x |
| **内存映射** | mmap 文件 | 减少系统调用 |
| **批量刷盘** | 累积 N 条或 T 秒刷一次 | 减少刷盘次数 |

#### 顺序写入 vs 随机写入

```
顺序写入速度：500MB/s（SSD）
随机写入速度：5MB/s（SSD）

消息队列使用顺序写入，性能提升 100x。
```

---

### 瓶颈 2：网络 I/O

#### 问题

高吞吐下，网络带宽成为瓶颈。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **批量发送** | 累积 N 条一起发 | 减少网络往返 |
| **零拷贝** | sendfile() 系统调用 | 减少 CPU 开销 |
| **连接池** | 复用 TCP 连接 | 减少连接建立开销 |
| **数据压缩** | gzip/snappy | 减少带宽占用 |

#### 批量发送

```go
func (p *Producer) SendBatch(messages []*Message) error {
    // 1. 批量序列化
    batch := p.batchBuilder.Build(messages)

    // 2. 一次网络发送
    return p.client.Write(batch)
}
```

---

### 瓶颈 3：分区副本同步

#### 问题

Leader-Follower 同步延迟影响吞吐。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **异步复制** | 写入后立即返回 | 吞吐提升 |
| **ISR（In-Sync Replicas）** | 只同步健康副本 | 容错兼顾性能 |
| **Pipelining** | 批量同步 | 减少网络往返 |

---

### 瓶颈 4：消费者处理瓶颈

#### 问题

消费者处理慢导致消息堆积。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **水平扩展** | 增加消费者实例 | 吞吐线性提升 |
| **批量消费** | 一次拉取多条 | 减少网络往返 |
| **快速失败** | 处理超时立即 NACK | 避免堆积 |
| **异步处理** | 非关键逻辑异步化 | 加快消费速度 |

---

## 扩展方案

### 扩展维度 1：队列水平扩展

```
单队列 → 多队列

Queue-1 (Partition 0-3)
Queue-2 (Partition 4-7)
Queue-3 (Partition 8-11)

路由：
  key = hash(message.Key) % totalPartitions
```

### 扩展维度 2：消费者组扩展

```
Consumer Group 内扩展：

Partition 0 → Consumer-1
Partition 1 → Consumer-2
Partition 2 → Consumer-3
Partition 3 → Consumer-1（重新分配）
```

### 扩展维度 3：多地域部署

```
Region CN（北京）
  └── Queue Cluster（主）

Region SG（新加坡）
  └── Queue Cluster（从）

跨地域复制：
  消息 → CN 写入 → 同步到 SG → SG 消费
```

---

## 容量规划

### QPS 容量估算

```
目标 QPS = 10W

单队列吞吐 = 10W QPS

分区规划：
  - Partition 数量 = Consumer 数量（最优）
  - Partition 数量 = 10（每个 Partition 1W QPS）

消费者规划：
  - 每个 Consumer 处理 1W QPS
  - 需要 10 个 Consumer 实例
```

### 存储容量估算

```
消息大小：平均 1KB
消息保留：7 天
峰值堆积：1000W 条

存储容量 = 1KB × 1000W = 10GB
  + 副本 1 份 = 20GB
  + 索引 = 2GB
  + 预留 = 5GB

总计：约 30GB

建议配置：100GB SSD × 3 副本 = 300GB
```

### 内存容量估算

```
Partition 缓存：
  - 每个 Partition 缓存最近 1GB 消息
  - 10 个 Partition = 10GB

消费者缓冲区：
  - 每个 Consumer 缓冲区 100MB
  - 10 个 Consumer = 1GB

总计：约 11GB

建议配置：32GB 内存
```

---

## 监控指标

### 核心指标

```prometheus
# 吞吐量
queue_messages_produced_total 12345678
queue_messages_consumed_total 12345678

# 延迟
queue_end_to_end_latency_seconds{quantile="0.99"} 0.008

# 积压
queue_message_backlog 1234567
queue_consumer_lag 5678

# 消费者
queue_consumers_active 10
queue_consumers_idle 0

# 分区
queue_partition_leader 0
queue_partition_replicas_in_sync 3
queue_partition_replicas_total 3

# DLQ
queue_dlq_messages_total 123
queue_dlq_backlog 456
```

### 告警阈值

| 指标 | 警告 | 严重 |
|------|------|------|
| 消费 lag | > 10W | > 50W |
| 消息积压 | > 100W | > 500W |
| 端到端延迟 P99 | > 100ms | > 500ms |
| DLQ 积压 | > 1000 | > 10000 |
| 副本不同步 | > 1 | > 2 |
