# API

## 消息队列 API

### 1. 队列管理 API

#### 创建队列

```http
POST /v1/queues
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "name": "order_created_queue",
  "type": "durable",
  "partitions": 3,
  "retention_hours": 168,
  "max_message_size_bytes": 1048576,
  "settings": {
    "dedup_enabled": true,
    "dedup_window_seconds": 300
  }
}
```

响应：

```json
{
  "queue_id": "queue-01HV3WWZP1A3B5C6D7E8F9G0H",
  "name": "order_created_queue",
  "type": "durable",
  "partitions": 3,
  "retention_hours": 168,
  "created_at": "2024-06-01T10:00:00Z"
}
```

#### 获取队列信息

```http
GET /v1/queues/{queue_name}
```

响应：

```json
{
  "queue_id": "queue-01HV3WWZP...",
  "name": "order_created_queue",
  "type": "durable",
  "partitions": 3,
  "message_count": 1234567,
  "consumer_count": 5,
  "retention_hours": 168,
  "settings": {
    "dedup_enabled": true
  }
}
```

---

### 2. 消息发送 API

#### 发送单条消息

```http
POST /v1/queues/{queue_name}/messages
Content-Type: application/json

{
  "body": "{\"order_id\":\"o123\",\"amount\":9900}",
  "message_id": "msg-01HV3WWZP...",
  "partition_key": "user_12345",
  "headers": {
    "content_type": "application/json",
    "trace_id": "trace-abc123"
  },
  "delay_seconds": 0
}
```

响应：

```json
{
  "message_id": "msg-01HV3WWZP1A3B5C6D7E8F9G0H",
  "partition": 0,
  "offset": 12345678,
  "timestamp": "2024-06-01T10:00:00Z"
}
```

#### 批量发送消息

```http
POST /v1/queues/{queue_name}/messages/batch
Content-Type: application/json

{
  "messages": [
    {"body": "{...}", "partition_key": "user_1"},
    {"body": "{...}", "partition_key": "user_2"},
    {"body": "{...}", "partition_key": "user_1"}
  ]
}
```

响应：

```json
{
  "sent_count": 3,
  "message_ids": [
    "msg-001", "msg-002", "msg-003"
  ]
}
```

---

### 3. 消息消费 API

#### 消费消息（Pull 模式）

```http
POST /v1/queues/{queue_name}/consume
Content-Type: application/json

{
  "consumer_group": "order_processor",
  "consumer_id": "consumer-001",
  "batch_size": 10,
  "max_wait_ms": 5000
}
```

响应：

```json
{
  "messages": [
    {
      "message_id": "msg-01HV3WWZP...",
      "body": "{\"order_id\":\"o123\",\"amount\":9900}",
      "partition": 0,
      "offset": 12345678,
      "partition_key": "user_12345",
      "headers": {
        "trace_id": "trace-abc123"
      },
      "timestamp": "2024-06-01T10:00:00Z",
      "redelivered": false
    }
  ],
  "request_id": "req-01HV3WWZP..."
}
```

#### 手动 ACK

```http
POST /v1/queues/{queue_name}/ack
Content-Type: application/json

{
  "message_ids": [
    "msg-01HV3WWZP...",
    "msg-01HV3WWZP-2..."
  ],
  "consumer_id": "consumer-001"
}
```

响应：

```json
{
  "acked_count": 2
}
```

#### NACK（Negative Acknowledgement）

```http
POST /v1/queues/{queue_name}/nack
Content-Type: application/json

{
  "message_id": "msg-01HV3WWZP...",
  "consumer_id": "consumer-001",
  "reason": "processing_failed",
  "requeue": true,
  "delay_ms": 5000
}
```

---

### 4. 死信队列 API

#### 查看 DLQ 消息

```http
GET /v1/queues/{queue_name}/dlq/messages?limit=10
```

响应：

```json
{
  "messages": [
    {
      "message_id": "msg-01HV3WWZP...",
      "original_queue": "order_created_queue",
      "body": "{\"order_id\":\"o123\"}",
      "error_reason": "max_retries_exceeded",
      "failed_at": "2024-06-01T10:00:00Z",
      "retry_count": 3
    }
  ]
}
```

#### 重新投放到原队列

```http
POST /v1/queues/{queue_name}/dlq/requeue
Content-Type: application/json

{
  "message_id": "msg-01HV3WWZP...",
  "delay_seconds": 60
}
```

#### 消费 DLQ 消息

```http
POST /v1/queues/{queue_name}/dlq/consume
Content-Type: application/json

{
  "batch_size": 5
}
```

---

### 5. 消费者组管理 API

#### 创建消费者组

```http
POST /v1/queues/{queue_name}/consumer-groups
Content-Type: application/json

{
  "group_name": "order_processor",
  "settings": {
    "min_consumers": 2,
    "max_consumers": 10,
    "max_poll_records": 100
  }
}
```

#### 获取消费者组状态

```http
GET /v1/queues/{queue_name}/consumer-groups/{group_name}
```

响应：

```json
{
  "group_name": "order_processor",
  "consumers": [
    {
      "consumer_id": "consumer-001",
      "status": "active",
      "lag": 1234,
      "last_heartbeat": "2024-06-01T10:05:00Z"
    }
  ],
  "total_lag": 5678
}
```

---

### 6. 延迟消息 API

#### 发送延迟消息

```http
POST /v1/queues/{queue_name}/messages
Content-Type: application/json

{
  "body": "{\"order_id\":\"o123\"}",
  "delay_seconds": 3600
}
```

响应：

```json
{
  "message_id": "msg-01HV3WWZP...",
  "available_at": "2024-06-01T11:00:00Z"
}
```

---

### 7. 消息查询 API

#### 根据 ID 查询消息

```http
GET /v1/queues/{queue_name}/messages/{message_id}
```

响应：

```json
{
  "message_id": "msg-01HV3WWZP...",
  "body": "{\"order_id\":\"o123\"}",
  "partition": 0,
  "offset": 12345678,
  "status": "consumed",
  "consumers": [
    {"consumer_id": "consumer-001", "acked_at": "2024-06-01T10:01:00Z"}
  ]
}
```

---

## Event Contract

| Event | 触发时机 | 消费者 |
|-------|---------|--------|
| `queue.message.sent` | 消息发送成功 | 统计、监控 |
| `queue.message.consumed` | 消息被消费 | 统计、监控 |
| `queue.message.acked` | 消息确认 | 队列清理 |
| `queue.message.nacked` | 消息拒绝 | 重试逻辑 |
| `queue.message.dlq` | 消息进入 DLQ | 告警、人工处理 |
| `queue.consumer.registered` | 消费者注册 | 负载均衡 |
| `queue.consumer.lag` | 消费 lag 增大 | 告警 |
| `queue.backlog.grow` | 消息堆积 | 告警、扩容 |
