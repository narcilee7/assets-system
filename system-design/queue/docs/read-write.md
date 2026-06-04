# Read & Write Path

## 消息队列核心流程

### 消息发送流程

```
Producer 发送消息
  │
  ▼
[1] 消息序列化和大小校验
  │
  ▼
[2] 消息持久化（Write-Ahead Log + 内存）
  │
  ▼
[3] 写入 Partition（日志追加）
  │
  ▼
[4] 分区副本同步（如果配置了副本）
  │
  ▼
[5] 返回 ACK 给 Producer
```

### 消息消费流程

```
Consumer 拉取消息
  │
  ▼
[1] 获取分配给自己的 Partition
  │
  ▼
[2] 从 Partition 拉取消息（按 offset）
  │
  ▼
[3] 消息投递给 Consumer
  │
  ▼
[4] Consumer 处理消息
  │
  ▼
[5] Consumer 返回 ACK/NACK
  │
  ▼
[6] 更新消费位移
```

---

## 详细阶段分析

### 消息发送（Producer Side）

#### 消息序列化

```go
func (p *Producer) Send(msg *Message) error {
    // 1. 序列化消息体
    data, err := json.Marshal(msg.Body)
    if err != nil {
        return err
    }

    // 2. 大小校验
    if len(data) > p.maxMessageSize {
        return ErrMessageTooLarge
    }

    // 3. 消息持久化
    err = p.writeToLog(msg)
    if err != nil {
        return err
    }

    // 4. 发送 ACK
    return nil
}
```

#### 消息持久化（Write-Ahead Log）

```go
func (q *Queue) writeToLog(msg *Message) error {
    // 1. 追加写入 WAL
    q.walMu.Lock()
    offset := q.wal.Append(msg)
    q.walMu.Unlock()

    // 2. 更新内存索引
    q.indexMu.Lock()
    q.index[msg.Partition][offset] = msg
    q.indexMu.Unlock()

    // 3. 异步刷盘
    go q.flushAsync()

    return nil
}
```

### 消息消费（Consumer Side）

#### 拉取消息

```go
func (c *Consumer) Poll(batchSize int, timeout time.Duration) ([]*Message, error) {
    // 1. 获取分配的 Partition
    partitions := c.assignedPartitions

    // 2. 按 Partition 并行拉取
    var wg sync.WaitGroup
    results := make(chan []*Message, len(partitions))

    for _, partition := range partitions {
        wg.Add(1)
        go func(p int) {
            defer wg.Done()
            msgs, err := c.fetchFromPartition(p, batchSize/len(partitions))
            if err != nil {
                return
            }
            results <- msgs
        }(partition)
    }
    wg.Wait()

    // 3. 合并结果
    return mergeResults(results), nil
}
```

#### 消息消费处理

```go
func (c *Consumer) Consume(msg *Message) error {
    // 1. 幂等检查
    if c.isDuplicate(msg.ID) {
        return nil  // 重复消息，跳过
    }

    // 2. 执行业务逻辑
    err := c.process(msg)
    if err != nil {
        // 3. 处理失败，NACK
        return c.Nack(msg.ID, err)
    }

    // 4. 处理成功，ACK
    return c.Ack(msg.ID)
}
```

---

## ACK 机制详解

### 自动 ACK vs 手动 ACK

```go
// 自动 ACK（消息投递后立即 ACK）
func (c *Consumer) ConsumeAuto(msg *Message) error {
    c.deliverToConsumer(msg)  // 投递消息
    return c.Ack(msg.ID)      // 立即 ACK
}

// 手动 ACK（处理完成后才 ACK）
func (c *Consumer) ConsumeManual(msg *Message) error {
    c.deliverToConsumer(msg)   // 投递消息
    // 等待业务处理完成
    result := <-msg.DoneChan
    if result.Error != nil {
        return c.Nack(msg.ID, result.Error)  // NACK，触发重试
    }
    return c.Ack(msg.ID)                  // 手动 ACK
}
```

### 批量 ACK

```go
func (c *Consumer) AckBatch(messageIDs []string) error {
    // 1. 批量更新位移
    offsets, err := c.updateOffsets(messageIDs)
    if err != nil {
        return err
    }

    // 2. 批量提交 ACK
    return c.commitOffsets(offsets)
}
```

---

## 重试机制详解

### 指数退避重试

```go
type RetryPolicy struct {
    MaxRetries     int
    InitialDelay   time.Duration
    MaxDelay      time.Duration
    BackoffFactor float64
}

func (r *RetryPolicy) NextDelay(attempt int) time.Duration {
    delay := float64(r.InitialDelay) * math.Pow(r.BackoffFactor, float64(attempt))
    if delay > float64(r.MaxDelay) {
        delay = float64(r.MaxDelay)
    }
    // 加随机 jitter 避免惊群
    jitter := time.Duration(rand.Int63n(int64(delay / 4)))
    return time.Duration(delay) + jitter
}
```

### 消息重试流程

```
消息消费失败
  │
  ▼
检查重试次数
  │
  ├── < 最大重试次数
  │    ├── 计算延迟（指数退避）
  │    ├── 延迟后重新入队
  │    └── delivery_count++
  │
  └── >= 最大重试次数
       ├── 进入 DLQ
       └── 触发告警
```

### NACK 实现

```go
func (c *Consumer) Nack(messageID string, err error) error {
    msg, _ := c.getMessage(messageID)

    if msg.DeliveryCount >= c.maxRetries {
        // 超过最大重试次数，进入 DLQ
        return c.routeToDLQ(msg, err)
    }

    // 计算延迟
    delay := c.retryPolicy.NextDelay(msg.DeliveryCount)

    // 延迟后重新入队
    return c.requeueWithDelay(msg, delay)
}
```

---

## 幂等消费实现

### 消息去重表

```go
func (c *Consumer) isDuplicate(messageID string) bool {
    // 1. 检查 Redis 去重表
    exists, _ := c.redis.Exists("dedup:" + messageID)
    if exists {
        return true
    }

    // 2. 不存在，插入 processing 状态
    c.redis.Set("dedup:"+messageID, "processing", 24*time.Hour)

    // 3. 开启 goroutine 处理超时清理
    go c.cleanupIfTimeout(messageID)

    return false
}

func (c *Consumer) MarkProcessed(messageID string) {
    c.redis.Set("dedup:"+messageID, "processed", 24*time.Hour)
}
```

### 业务幂等（订单状态机）

```go
func (p *OrderService) ProcessPayment(msg *Message) error {
    order := parseOrder(msg.Body)

    // 状态机保证幂等
    updated, err := p.db.Exec(`
        UPDATE orders
        SET status = 'paid', paid_at = NOW()
        WHERE id = ? AND status = 'pending'
    `, order.ID)

    if updated == 0 {
        // 状态不是 pending，说明已处理过，直接返回成功
        return nil
    }

    return p.doPayment(order)
}
```

---

## 顺序保证实现

### 单 Partition 顺序

```go
func (p *Producer) SendOrderMessage(orderID string, msg *Message) error {
    // 1. 计算 Partition
    partition := hash(orderID) % p.partitions

    // 2. 发送到同一 Partition
    return p.sendToPartition(partition, msg)
}
```

### 乱序场景与处理

```
同一用户的订单操作：
  1. 创建订单（Partition 0）
  2. 支付订单（Partition 0）
  3. 取消订单（Partition 0）

如果重试：
  - 取消消息在支付之前到达
  - 消费者按时间戳排序，而非到达顺序
  - 或使用业务时间戳排序
```

---

## 延迟消息实现

### 延迟队列（Timer Wheel）

```go
type TimerWheel struct {
    tickMs    int64
    wheelSize  int
    wheels    [][]*DelayedMessage
    cursor    int64
}

func (tw *TimerWheel) Add(msg *DelayedMessage, delay time.Duration) {
    slot := (tw.cursor + delay.Milliseconds()/tw.tickMs) % tw.wheelSize
    tw.wheels[slot] = append(tw.wheels[slot], msg)
}
```

### 延迟消息流程

```
发送延迟消息（delay=1h）
  │
  ▼
存入 Timer Wheel
  │
  ▼
等待触发时间
  │
  ▼
触发后写入主队列
  │
  ▼
正常消费流程
```
