# Failure Mode

## F1: 消息丢失

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| Producer 发送后 ACK 丢失 | 网络抖动 | 消息实际已存储但 Producer 认为失败 |
| Broker 宕机 | 机器故障 | 未刷盘的消息丢失 |
| 磁盘故障 | 硬盘损坏 | 消息永久丢失 |

### 应对策略

#### 1. 同步刷盘

```go
// 同步刷盘保证消息持久化
func (q *Queue) AppendWithSync(msg *Message) error {
    // 1. 写入日志
    err := q.wal.Append(msg)
    if err != nil {
        return err
    }

    // 2. 强制刷盘
    err = q.wal.Sync()
    if err != nil {
        return err
    }

    // 3. 才返回成功
    return nil
}
```

#### 2. 副本同步

```go
// Leader-Follower 复制
func (p *Partition) WaitForReplication(msg *Message, requiredAcks int) error {
    // 等待 requiredAcks 个 Follower 确认
    for {
        acks := p.getConfirmedCount()
        if acks >= requiredAcks {
            return nil
        }
        time.Sleep(10 * time.Millisecond)
    }
}
```

#### 3. Producer 端重试

```go
// Producer 发送失败自动重试
producer := NewProducer(WithRetry(
    MaxRetries: 3,
    RetryDelay: time.Second,
))

// 消息发送后等待 ACK，超时重试
result, err := producer.Send(msg)
if err != nil {
    // 自动重试直到成功或超次数
}
```

---

## F2: 消息重复消费

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| Consumer ACK 失败 | 网络抖动 | 消息被重复投递 |
| 重试导致 | 消息处理超时被重新投递 | 重复处理 |
| 消费者重启 | 重复拉取未 ACK 的消息 | 重复处理 |

### 应对策略

#### 1. 幂等消费者

```go
func (c *Consumer) ProcessWithIdempotency(msg *Message) error {
    // 1. 去重表检查
    key := "dedup:" + msg.ID
    existed, _ := c.redis.SetNX(key, "processing", 24*time.Hour)
    if !existed {
        return nil  // 已处理过，跳过
    }

    // 2. 执行业务逻辑
    err := c.process(msg.Body)

    // 3. 处理成功，标记为已处理
    if err == nil {
        c.redis.Set(key, "processed", 24*time.Hour)
    }

    return err
}
```

#### 2. 业务幂等（状态机）

```go
func (s *OrderService) PayOrder(orderID string) error {
    // 只有待支付状态才能扣款（状态机保证幂等）
    result := db.Exec(`
        UPDATE orders
        SET status='paid'
        WHERE id=? AND status='pending'
    `, orderID)

    if result.RowsAffected == 0 {
        return nil  // 已支付，直接返回成功
    }

    return s.doPay(orderID)
}
```

---

## F3: 消费者积压

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 消费者处理慢 | 业务逻辑复杂 | 新消息延迟增大 |
| 消费者崩溃 | 消费者故障 | 消息无人消费 |
| 消费者不足 | 并发数不够 | 消费速度跟不上生产速度 |

### 应对策略

#### 1. 消费者水平扩展

```go
// 增加消费者实例
func ScaleConsumers(groupName string, targetCount int) error {
    for i := 0; i < targetCount; i++ {
        go StartConsumer(groupName, "consumer-"+uuid.New().String())
    }
    return nil
}
```

#### 2. 分区重新分配

```
当消费者数量变化时：
  1. 触发 Rebalance
  2. 重新计算分区分配
  3. 新消费者开始消费
  4. 旧消费者停止消费并提交 offset
```

#### 3. 背压机制

```go
// 消费者处理速度跟不上时，减缓生产速度
func (p *Producer) SendWithBackpressure(msg *Message) error {
    lag := p.getConsumerLag()
    if lag > p.backpressureThreshold {
        // 消费者 lag 过高，减缓发送速度
        time.Sleep(time.Second)
    }
    return p.Send(msg)
}
```

---

## F4: 重试风暴

### 场景

大量消息同时失败，导致大量重试请求打到下游服务，下游服务被打垮。

### 应对策略

#### 1. 指数退避

```go
func (p *RetryPolicy) GetDelay(attempt int) time.Duration {
    base := time.Second
    max := time.Minute
    factor := 2.0

    delay := base * time.Duration(math.Pow(factor, float64(attempt)))
    if delay > max {
        delay = max
    }

    // 加随机 jitter 避免惊群
    jitter := time.Duration(rand.Int63n(int64(delay / 4)))
    return delay + jitter
}
```

#### 2. 熔断器

```go
type CircuitBreaker struct {
    failures     int
    threshold   int
    state       CircuitState  // closed / open / half_open
}

func (cb *CircuitBreaker) Call(fn func() error) error {
    if cb.state == Open {
        if time.Since(cb.lastFailure) > cb.resetTimeout {
            cb.state = HalfOpen
        } else {
            return ErrCircuitOpen
        }
    }

    err := fn()
    if err != nil {
        cb.failures++
        if cb.failures > cb.threshold {
            cb.state = Open
            cb.lastFailure = time.Now()
        }
        return err
    }

    cb.failures = 0
    cb.state = Closed
    return nil
}
```

#### 3. 限流

```go
// 下游限流保护
rateLimiter := redis.NewRateLimiter(1000) // 1000 QPS

func (c *Consumer) callDownstream(msg *Message) error {
    if !rateLimiter.Allow() {
        return ErrRateLimited
    }
    return downstream.Call(msg)
}
```

---

## F5: 消息乱序

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 并行消费 | 不同 Partition 并行处理 | 全局无序 |
| 重试乱序 | 重试消息可能先于正常消息到达 | 同实体消息乱序 |
| 多消费者 | 不同消费者处理速度不同 | 同 Partition 消息乱序 |

### 应对策略

#### 1. 按业务 Key 分区

```go
// 同一用户的消息发送到同一 Partition
func (p *Producer) SendUserMsg(userID string, msg *Message) error {
    partition := hash(userID) % p.partitions
    return p.sendToPartition(partition, msg)
}
```

#### 2. 消息时间戳排序

```go
func (c *Consumer) SortByTimestamp(messages []*Message) []*Message {
    sort.Slice(messages, func(i, j int) bool {
        return messages[i].Timestamp < messages[j].Timestamp
    })
    return messages
}
```

#### 3. 顺序号机制

```go
type SequencedMessage struct {
    Sequence int64
    Body     []byte
}

// 消费者按 Sequence 顺序处理
func (c *Consumer) ProcessSequenced(msg *SequencedMessage) error {
    if msg.Sequence != c.lastSequence+1 {
        // 顺序不对，等待或重试
        return ErrOutOfOrder
    }
    c.lastSequence = msg.Sequence
    return c.process(msg.Body)
}
```

---

## F6: 分区分配不均

### 场景

消费者数量变化时，分区重新分配不均匀，导致部分消费者负载过高。

### 应对策略

#### 1. 均匀分配算法

```go
func RebalancePartitions(consumerCount, partitionCount int) [][]int {
    // 轮询分配
    result := make([][]int, consumerCount)
    for i := 0; i < partitionCount; i++ {
        consumer := i % consumerCount
        result[consumer] = append(result[consumer], i)
    }
    return result
}
```

#### 2. 最优分配（贪心）

```go
func OptimalRebalance(consumers []*Consumer, partitions []int) map[string][]int {
    // 按消费者处理能力排序，能力强的分配更多分区
    sort.Slice(consumers, func(i, j int) bool {
        return consumers[i].Capacity > consumers[j].Capacity
    })

    assignment := make(map[string][]int)
    for _, p := range partitions {
        // 分配给负载最小的消费者
        minConsumer := findMinLoadConsumer(consumers)
        assignment[minConsumer.ID] = append(assignment[minConsumer.ID], p)
    }
    return assignment
}
```

---

## F7: 死信队列积压

### 场景

DLQ 消息无人处理，长期积压。

### 应对策略

#### 1. DLQ 监控告警

```yaml
alert: DLQBacklog
  expr: increase(queue_dlq_messages_total[1h]) > 100
  for: 5m
  labels:
    severity: warning
```

#### 2. DLQ 自动重试

```go
func (q *Queue) AutoRetryDLQ(maxAge time.Duration) error {
    messages := q.GetDLQMessages(maxAge)

    for _, msg := range messages {
        // 修复消息
        err := q.fixMessage(msg)
        if err == nil {
            // 重新投放到原队列
            q.Requeue(msg)
        }
    }
}
```

#### 3. DLQ 清理策略

```sql
-- 清理超过 30 天的 DLQ 消息
DELETE FROM dlq_messages
WHERE failed_at < NOW() - INTERVAL 30 DAY
AND status = 'consumed';
```
