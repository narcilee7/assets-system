# Data Model

## 核心设计原则

- **消息不可变**：消息一旦发送不可修改
- **分区有序**：同一 Partition 内消息有序
- **ACK 驱动**：消息消费后必须 ACK
- **持久化优先**：消息先持久化再投递

---

## 1. 队列数据模型

### 队列定义

```sql
CREATE TABLE queues (
    id              VARCHAR(64) PRIMARY KEY,
    name            VARCHAR(256) NOT NULL UNIQUE,
    type            ENUM('durable', 'transient') DEFAULT 'durable',
    partitions      INT NOT NULL DEFAULT 1,
    retention_hours INT DEFAULT 168,

    -- 设置
    max_message_size_bytes INT DEFAULT 1048576,
    dedup_enabled   BOOLEAN DEFAULT FALSE,
    dedup_window_seconds INT DEFAULT 300,

    -- 统计
    message_count   BIGINT DEFAULT 0,
    consumer_count  INT DEFAULT 0,

    -- 状态
    status          ENUM('active', 'paused', 'deleted') DEFAULT 'active',

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_name (name)
);
```

---

## 2. 分区数据模型

### 分区（Partition / Shard）

```sql
CREATE TABLE partitions (
    id              VARCHAR(64) PRIMARY KEY,
    queue_id        VARCHAR(64) NOT NULL,
    partition_index  INT NOT NULL,

    -- 偏移量
    current_offset  BIGINT DEFAULT 0,
    committed_offset BIGINT DEFAULT 0,

    -- 状态
    status          ENUM('active', 'leader', 'follower') DEFAULT 'active',

    -- 副本
    replica_count   INT DEFAULT 1,
    in_sync_replicas INT DEFAULT 1,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_queue (queue_id)
);
```

---

## 3. 消息数据模型

### 消息存储

```sql
CREATE TABLE messages (
    id              VARCHAR(64) PRIMARY KEY,
    queue_id        VARCHAR(64) NOT NULL,
    partition       INT NOT NULL,
    offset         BIGINT NOT NULL,

    -- 消息内容
    body            BLOB NOT NULL,
    headers         JSON,

    -- 路由
    partition_key   VARCHAR(256),

    -- 时间
    timestamp       TIMESTAMP NOT NULL,
    delay_until     TIMESTAMP,

    -- 状态
    status          ENUM('pending', 'consumed', 'expired', 'dlq') DEFAULT 'pending',
    delivery_count  INT DEFAULT 0,

    -- 索引
    UNIQUE KEY uk_partition_offset (partition, offset),
    INDEX idx_queue_status (queue_id, status),
    INDEX idx_partition_timestamp (partition, timestamp),

    FOREIGN KEY (queue_id) REFERENCES queues(id)
);
```

### 消息偏移量（Offset）

```
Offset = Partition 内消息的唯一序号
  - 每个 Partition 的 offset 从 0 开始递增
  - 消费者通过 offset 追踪消费位置
```

---

## 4. 消费者数据模型

### 消费者组

```sql
CREATE TABLE consumer_groups (
    id              VARCHAR(64) PRIMARY KEY,
    queue_id        VARCHAR(64) NOT NULL,
    group_name      VARCHAR(256) NOT NULL,

    -- 设置
    min_consumers   INT DEFAULT 1,
    max_consumers   INT DEFAULT 10,
    max_poll_records INT DEFAULT 100,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_queue_group (queue_id, group_name),
    INDEX idx_queue (queue_id)
);
```

### 消费者实例

```sql
CREATE TABLE consumers (
    id              VARCHAR(64) PRIMARY KEY,
    group_id        VARCHAR(64) NOT NULL,
    consumer_id     VARCHAR(256) NOT NULL,

    -- 分区分配
    assigned_partitions JSON,  -- [0, 1, 2]

    -- 状态
    status          ENUM('active', 'idle', 'dead') DEFAULT 'active',
    last_heartbeat  TIMESTAMP,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_group (group_id)
);
```

### 消费者位移（Consumer Offset）

```sql
CREATE TABLE consumer_offsets (
    id              VARCHAR(64) PRIMARY KEY,
    consumer_group_id VARCHAR(64) NOT NULL,
    partition       INT NOT NULL,

    -- 消费位置
    committed_offset BIGINT NOT NULL,
    committed_at   TIMESTAMP,

    -- lag 计算
    lag             BIGINT DEFAULT 0,

    UNIQUE KEY uk_consumer_partition (consumer_group_id, partition)
);
```

---

## 5. 死信队列数据模型

### DLQ 消息

```sql
CREATE TABLE dlq_messages (
    id              VARCHAR(64) PRIMARY KEY,
    original_queue_id VARCHAR(64) NOT NULL,
    original_message_id VARCHAR(64) NOT NULL,

    -- 原始信息
    body            BLOB NOT NULL,
    headers         JSON,
    partition_key   VARCHAR(256),

    -- 失败信息
    error_reason   VARCHAR(256),
    retry_count    INT DEFAULT 0,
    max_retries    INT DEFAULT 3,

    -- 状态
    status          ENUM('pending', 'consumed', 'discarded') DEFAULT 'pending',

    -- 时间
    failed_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    consumed_at     TIMESTAMP,

    INDEX idx_queue_status (original_queue_id, status),
    INDEX idx_failed_at (failed_at)
);
```

---

## 6. 消息幂等数据模型

### 消息去重表（用于 At-least-once 幂等）

```sql
CREATE TABLE message_dedup (
    message_id       VARCHAR(64) PRIMARY KEY,
    queue_id        VARCHAR(64) NOT NULL,
    status          ENUM('processed', 'processing') DEFAULT 'processing',

    -- 过期时间（用于自动清理）
    expires_at     TIMESTAMP,

    processed_at    TIMESTAMP,

    INDEX idx_queue (queue_id),
    INDEX idx_expires (expires_at)
);
```

### 幂等机制流程

```
1. 收到消息，检查 message_dedup 表
2. 如果已 processed → 跳过
3. 如果不存在 → 插入 processing 状态，开始处理
4. 处理成功 → 更新为 processed
5. 处理失败 → 删除记录，允许重试
```

---

## 7. 重试队列数据模型

### 延迟消息（Timer Queue）

```sql
CREATE TABLE delayed_messages (
    id              VARCHAR(64) PRIMARY KEY,
    queue_id        VARCHAR(64) NOT NULL,
    body            BLOB NOT NULL,
    headers         JSON,
    partition_key   VARCHAR(256),

    -- 触发时间
    trigger_at      TIMESTAMP NOT NULL,

    -- 重试信息
    retry_count     INT DEFAULT 0,
    max_retries     INT DEFAULT 3,

    -- 状态
    status          ENUM('pending', 'triggered', 'discarded') DEFAULT 'pending',

    INDEX idx_trigger (trigger_at, status)
);
```

---

## 8. 消费者进度模型

### 消费Lag监控

```
Lag = committed_offset - consumer_position

Lag 越大 = 消费越慢 = 堆积越严重
```

```sql
CREATE TABLE consumer_lag (
    consumer_group_id VARCHAR(64) NOT NULL,
    partition       INT NOT NULL,

    current_lag     BIGINT DEFAULT 0,
    max_lag         BIGINT DEFAULT 0,

    updated_at      TIMESTAMP,

    PRIMARY KEY (consumer_group_id, partition)
);
```

---

## 9. 消息投递状态机

```
                    ┌──────────┐
                    │ pending │
                    └────┬────┘
                         │ 投递到消费者
                         ▼
                    ┌──────────┐
                    │delivered│
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌────────┐
         │ acked  │ │ nacked │ │ timeout│
         └────────┘ └────────┘ └────────┘
              │          │          │
              │      重试 ▼      重试 ▼
              │      pending      pending
              │
         ┌────────┐
         │ dlq    │
         └────────┘
```

---

## 10. 分区副本数据模型

### Leader-Follower 复制

```sql
CREATE TABLE partition_replicas (
    id              VARCHAR(64) PRIMARY KEY,
    partition_id    VARCHAR(64) NOT NULL,
    replica_id      INT NOT NULL,
    node_id         VARCHAR(64) NOT NULL,

    -- 复制进度
    log_end_offset BIGINT DEFAULT 0,
    confirmed_offset BIGINT DEFAULT 0,

    -- 状态
    status          ENUM('active', 'syncing', 'offline') DEFAULT 'active',

    INDEX idx_partition (partition_id)
);
```

### 复制状态

```
Leader → Follower 复制：
  1. Producer 发送消息到 Leader
  2. Leader 写入本地日志
  3. Follower 从 Leader 拉取消息
  4. Follower 写入本地日志后 ACK
  5. Leader 收到所有 Follower ACK 后，消息变为 committed
```
