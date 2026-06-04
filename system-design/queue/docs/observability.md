# Observability

## 三大支柱

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    日志      │    │    指标      │    │    链路      │
│  (Logs)      │    │  (Metrics)   │    │  (Traces)    │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ 消息发送     │    │ QPS/延迟    │    │ 生产→存储→消费│
│ 消息消费     │    │ Lag/积压    │    │              │
│ 错误堆栈     │    │ DLQ/重试    │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 1. 日志（Logs）

### 消息发送日志

```json
{
  "event": "queue.message.produced",
  "queue_name": "order_created_queue",
  "message_id": "msg-01HV3WWZP...",
  "partition": 0,
  "offset": 12345678,
  "partition_key": "user_12345",
  "body_size_bytes": 512,
  "timestamp": "2024-06-01T10:00:00.000Z"
}
```

### 消息消费日志

```json
{
  "event": "queue.message.consumed",
  "queue_name": "order_created_queue",
  "message_id": "msg-01HV3WWZP...",
  "consumer_group": "order_processor",
  "consumer_id": "consumer-001",
  "partition": 0,
  "offset": 12345678,
  "delivery_count": 1,
  "processing_duration_ms": 45,
  "timestamp": "2024-06-01T10:00:05.000Z"
}
```

### ACK 日志

```json
{
  "event": "queue.message.acked",
  "queue_name": "order_created_queue",
  "message_id": "msg-01HV3WWZP...",
  "consumer_id": "consumer-001",
  "timestamp": "2024-06-01T10:00:10.000Z"
}
```

### NACK 日志

```json
{
  "event": "queue.message.nacked",
  "queue_name": "order_created_queue",
  "message_id": "msg-01HV3WWZP...",
  "consumer_id": "consumer-001",
  "error": "processing_timeout",
  "delivery_count": 2,
  "will_retry": true,
  "timestamp": "2024-06-01T10:00:15.000Z"
}
```

### DLQ 日志

```json
{
  "event": "queue.message.dlq",
  "queue_name": "order_created_queue",
  "message_id": "msg-01HV3WWZP...",
  "dlq_name": "order_created_queue_dlq",
  "error": "max_retries_exceeded",
  "delivery_count": 3,
  "timestamp": "2024-06-01T10:00:30.000Z"
}
```

---

## 2. 指标（Metrics）

### 吞吐量指标

```prometheus
# 生产速度
queue_messages_produced_total{queue="order_queue"} 12345678
queue_produce_rate{queue="order_queue"} 1423.5

# 消费速度
queue_messages_consumed_total{queue="order_queue", consumer_group="order_processor"} 12345600
queue_consume_rate{queue="order_queue", consumer_group="order_processor"} 1423.2
```

### 延迟指标

```prometheus
# 端到端延迟
queue_end_to_end_latency_seconds{queue="order_queue", quantile="0.5"} 0.003
queue_end_to_end_latency_seconds{queue="order_queue", quantile="0.99"} 0.008
queue_end_to_end_latency_seconds{queue="order_queue", quantile="0.999"} 0.015

# 生产延迟
queue_produce_latency_seconds{queue="order_queue", quantile="0.99"} 0.002

# 消费延迟
queue_consume_latency_seconds{queue="order_queue", quantile="0.99"} 0.001
```

### 积压指标

```prometheus
# 消息积压
queue_message_backlog{queue="order_queue"} 123456
queue_message_backlog_per_partition{queue="order_queue", partition="0"} 30864

# 消费 lag
queue_consumer_lag{consumer_group="order_processor", partition="0"} 1234

# DLQ 积压
queue_dlq_backlog{queue="order_queue"} 456
```

### 消费者指标

```prometheus
# 活跃消费者
queue_consumers_active{queue="order_queue", consumer_group="order_processor"} 5
queue_consumers_idle{queue="order_queue", consumer_group="order_processor"} 0

# 消费者心跳
queue_consumer_heartbeat{consumer_id="consumer-001"} 1
```

### 重试指标

```prometheus
# 重试次数分布
queue_message_retry_count{queue="order_queue", retry_count="1"} 12345
queue_message_retry_count{queue="order_queue", retry_count="2"} 234
queue_message_retry_count{queue="order_queue", retry_count="3"} 12

# NACK 率
queue_nack_rate{queue="order_queue", consumer_group="order_processor"} 0.023
```

---

## 3. 链路追踪（Distributed Tracing）

### 消息追踪

```
Trace: trace-01HV3WWZP

Span: queue.produce
  │
  └── Span: queue.consume
        │
        └── Span: business.process
              │
              └── Span: downstream.call
```

---

## 4. 告警规则

| 告警名称 | 条件 | 严重程度 |
|----------|------|----------|
| **HighBacklog** | 积压 > 100W | P2 |
| **HighConsumerLag** | Lag > 10W | P2 |
| **HighNackRate** | NACK 率 > 5% | P1 |
| **DLQBacklog** | DLQ > 1000 | P2 |
| **ConsumerDown** | 消费者实例 = 0 | P0 |
| **ReplicationLag** | 副本延迟 > 1 | P1 |

---

## 5. 仪表盘

```
┌─────────────────────────────────────────────────────────────────┐
│  Queue Overview                      Region: CN-North-1           │
├─────────────────────────────────────────────────────────────────┤
│  Produce/sec   Consume/sec   Backlog      Lag                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │  1,423    │ │  1,420    │ │  123,456   │ │  5,678    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                              │
│  [Produce 趋势]        [Backlog 趋势]       [Lag 趋势]         │
│  ████████████         ▁▂▃▅▆▇█▇▅         ▁▁▁▁▁▁▂▃▄▅             │
├─────────────────────────────────────────────────────────────────┤
│  Consumers                    DLQ Backlog                       │
│  ┌────────────────────┐        ┌────────────────────┐          │
│  │ Active:  5        │        │ order_queue: 456 │          │
│  │ Idle:    0        │        │ payment_queue: 0 │          │
│  └────────────────────┘        └────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```
