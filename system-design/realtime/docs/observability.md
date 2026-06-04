# Observability

## 三大支柱

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    日志      │    │    指标      │    │    链路      │
│  (Logs)      │    │  (Metrics)   │    │  (Traces)    │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ 连接事件     │    │ 连接数/QPS   │    │ Trace ID     │
│ 消息收发    │    │ 延迟分布     │    │ Span 串联    │
│ 异常错误    │    │ 送达率/丢失率 │    │ 流追踪      │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 1. 日志（Logs）

### 连接事件日志

每条连接有独立的生命周期日志：

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "event": "connection.established",
  "conn_id": "conn-01HV3WWZP",
  "user_id": "user-001",
  "device_id": "device-abc",
  "conn_type": "websocket",
  "node_id": "node-03",
  "remote_ip": "1.2.3.4",
  "tls_version": "TLS1.3",
  "user_agent": "Mozilla/5.0 ...",
  "rooms": ["room-001", "room-002"],
  "connected_at": "2024-06-01T10:00:00.000Z",
  "error_msg": null
}
```

```json
{
  "event": "connection.closed",
  "conn_id": "conn-01HV3WWZP",
  "user_id": "user-001",
  "node_id": "node-03",
  "close_code": 1001,
  "close_reason": "normal_closure",
  "duration_seconds": 3600,
  "messages_sent": 145,
  "messages_received": 230,
  "last_heartbeat_at": "2024-06-01T10:59:55.000Z",
  "closed_at": "2024-06-01T11:00:00.000Z",
  "error_msg": null
}
```

```json
{
  "event": "connection.error",
  "conn_id": "conn-01HV3WWZP",
  "user_id": "user-001",
  "error_code": "1006",
  "error_msg": "abnormal_closure: network unreachable",
  "node_id": "node-03",
  "occurred_at": "2024-06-01T10:30:00.000Z"
}
```

### 消息日志

```json
{
  "request_id": "req-msg-01HV3WWZP",
  "mid": "msg-01HV3WWZP1A3B5C6D7E8F9G0H",
  "type": "message",
  "from_user_id": "user-001",
  "to_room_id": "room-001",
  "payload_size": 256,
  "ts": 1704067200001,
  "seq": 1234,
  "node_id": "node-03",
  "delivered_count": 95,
  "failed_count": 0,
  "delivery_latency_ms": 45,
  "status": "delivered"
}
```

### 心跳日志

```json
{
  "event": "heartbeat.timeout",
  "conn_id": "conn-01HV3WWZP",
  "user_id": "user-001",
  "node_id": "node-03",
  "missed_count": 3,
  "last_heartbeat_at": "2024-06-01T10:29:00.000Z",
  "closed_at": "2024-06-01T10:30:00.000Z"
}
```

### 流式输出日志

```json
{
  "event": "stream.started",
  "stream_id": "stream-abc123",
  "user_id": "user-001",
  "task_id": "task-xyz",
  "model": "gpt-4",
  "node_id": "node-03",
  "started_at": "2024-06-01T10:00:00.000Z"
}
```

```json
{
  "event": "stream.completed",
  "stream_id": "stream-abc123",
  "total_tokens": 1234,
  "total_latency_ms": 2345,
  "output_length": 5678,
  "completed_at": "2024-06-01T10:00:02.345Z"
}
```

---

## 2. 指标（Metrics）

### 连接指标

```prometheus
# 连接总数（按节点和类型分维度）
realtime_connections_active{node="$node", type="$type"} 95234
realtime_connections_total{node="$node", type="$type"} 125000

# 连接速率
realtime_connections_new_rate{node="$node"} 125.5
realtime_connections_close_rate{node="$node"} 98.3

# 连接时长分布（帮助分析用户行为）
realtime_connection_duration_seconds{node="$node", quantile="0.5"} 3600
realtime_connection_duration_seconds{node="$node", quantile="0.9"} 14400
realtime_connection_duration_seconds{node="$node", quantile="0.99"} 43200

# 连接错误
realtime_connection_errors_total{node="$node", reason="$reason"} 23
```

### 消息指标

```prometheus
# 消息发送量
realtime_messages_sent_total{node="$node", room_id="$room", direction="$dir"} 1234567
realtime_messages_sent_rate{node="$node"} 9523.5

# 消息送达率
realtime_messages_delivered_total{node="$node"} 1230000
realtime_messages_delivered_rate{node="$node"} 9523.5

# 消息延迟分布
realtime_message_delivery_latency_seconds{node="$node", room_id="$room", quantile="0.5"} 0.023
realtime_message_delivery_latency_seconds{node="$node", room_id="$room", quantile="0.9"} 0.045
realtime_message_delivery_latency_seconds{node="$node", room_id="$room", quantile="0.99"} 0.098
realtime_message_delivery_latency_seconds{node="$node", room_id="$room", quantile="0.999"} 0.150

# 消息丢失和重复
realtime_messages_lost_total{node="$node"} 12
realtime_messages_lost_rate{node="$node"} 0.00012
realtime_messages_duplicate_total{node="$node"} 56
realtime_messages_duplicate_rate{node="$node"} 0.00056

# 离线消息
realtime_offline_messages_total{node="$node"} 12345
realtime_offline_queue_size{user_id="$user"} 23
```

### 心跳指标

```prometheus
# 心跳
realtime_heartbeat_sent_total{node="$node"} 12345678
realtime_heartbeat_timeout_total{node="$node"} 234
realtime_heartbeat_response_latency_seconds{node="$node", quantile="0.99"} 0.005
```

### 流式输出指标

```prometheus
# 流式输出
realtime_streams_active{node="$node"} 125
realtime_streams_completed_total{node="$node"} 3456
realtime_streams_token_rate{node="$node", model="$model"} 12500.5
realtime_streams_token_latency_p99_ms{node="$node"} 45
```

### 房间指标

```prometheus
# 房间成员
realtime_room_members{room_id="$room"} 95234
realtime_room_message_rate{room_id="$room"} 5234.5

# 大房间（用于识别热点）
topk(10, realtime_room_members{room_id="$room"})
```

### 资源指标

```prometheus
# 内存
realtime_memory_bytes{node="$node"} 5242880000
realtime_memory_connections_bytes{node="$node"} 2147483648

# 连接数占容量的比例
realtime_connections_utilization{node="$node"} 0.85
```

---

## 3. 链路追踪（Distributed Tracing）

### WebSocket 的 Trace 上下文传播

WebSocket 是长连接，Trace 上下文在连接建立时传入，后续所有消息共享同一个 Trace ID：

```
连接建立（握手）
  │
  ▼
Header: X-Trace-ID: trace-01HV3WWZP
        X-Span-ID: span-01HV3WWZP-01
  │
  ▼
连接建立 Span（记录连接事件）
  │
  ▼
每条消息 Span（记录消息发送/接收）
  │
  ▼
连接关闭 Span（记录连接时长和统计）
```

### 消息级别的 Span

```go
// 每条消息发送时创建子 Span
func (conn *Connection) SendMessage(msg *Message) error {
    span := tracer.StartSpan("realtime.message.send",
        otel.TracerOption.WithParent(conn.rootSpan))
    defer span.End()

    span.SetAttributes(
        attribute.String("message.mid", msg.MID),
        attribute.String("message.type", msg.Type),
        attribute.String("message.to", msg.ToRoomID),
        attribute.Int64("message.seq", msg.Seq),
    )

    // 发送消息...
    err := conn.writeMessage(msg)

    span.SetAttributes(
        attribute.Int64("delivery.latency_ms", time.Since(msg.TS).Milliseconds()),
        attribute.Int("delivery.success", boolToInt(err == nil)),
    )

    return err
}
```

### 流式输出的 Trace

```
流任务开始
  │
  ▼
Parent Span: stream
  │
  ├── Child Span 1: token[1]
  ├── Child Span 2: token[2]
  ├── Child Span 3: token[3]
  │   ...
  │
  └── Child Span N: stream_end
```

---

## 4. 告警规则

### 核心告警

| 告警名称 | 条件 | 严重程度 | 说明 |
|----------|------|----------|------|
| **ConnectionLimitWarning** | 连接数 > 80% 容量，持续 5min | P2 | 连接数接近上限 |
| **ConnectionLimitCritical** | 连接数 > 95% 容量，持续 1min | P1 | 即将达到上限 |
| **HighMessageLossRate** | 消息丢失率 > 0.5%，持续 5min | P1 | 网络或服务端问题 |
| **HighMessageLatency** | 消息送达 P99 > 200ms，持续 5min | P2 | 服务端处理慢 |
| **HeartbeatTimeoutStorm** | 心跳超时数 > 100/分钟 | P2 | 可能是网络波动 |
| **ReconnectStorm** | 重连速率 > 1000/秒 | P1 | 可能是服务端故障 |
| **RoomHotspot** | 单房间 > 10W 成员 | P2 | 热点房间，需要分片 |
| **OfflineQueueGrowth** | 离线消息队列 > 1000/用户 | P2 | 用户长时间离线 |
| **StreamAccumulation** | Token 积压 > 100 | P2 | 客户端消费慢 |
| **RedisConnectionPressure** | Redis QPS > 80% 容量 | P1 | Redis 可能过载 |

### 告警配置示例

```yaml
groups:
  - name: realtime_alerts
    rules:
      - alert: ConnectionLimitWarning
        expr: |
          realtime_connections_active / realtime_max_connections > 0.80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "实时连接数接近上限"
          description: "节点 {{ $labels.node }} 连接数 {{ $value | humanizePercentage }}，超过 80% 阈值"

      - alert: HighMessageLossRate
        expr: |
          rate(realtime_messages_lost_total[5m]) /
          rate(realtime_messages_sent_total[5m]) > 0.005
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "消息丢失率过高"
          description: "消息丢失率 {{ $value | humanizePercentage }}，超过 0.5% 阈值，需要检查网络和服务端状态"

      - alert: ReconnectStorm
        expr: |
          rate(realtime_connections_close_total{reason="error"}[1m]) > 1000
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "重连风暴"
          description: "重连速率 {{ $value }}/s 超过 1000/s，可能是服务端故障"
```

---

## 5. 仪表盘（Grafana）

### 实时概览仪表盘

```
┌─────────────────────────────────────────────────────────────────┐
│  Realtime Overview                    Region: CN-North-1      │
├─────────────────────────────────────────────────────────────────┤
│  Active Connections    Messages/sec     Delivery Latency P99   │
│  ┌─────────────┐       ┌─────────────┐  ┌─────────────┐        │
│  │  952,341    │       │  12,543     │  │    45ms     │        │
│  │  +2.3%      │       │  +5.2%      │  │  +10ms      │        │
│  └─────────────┘       └─────────────┘  └─────────────┘        │
│                                                              │
│  [连接数趋势]          [消息速率]         [延迟分布]           │
│  ████████████         ▁▂▃▅▇█▇▅▃▂▁      ▁▁▁▂▂▃▄▅▆             │
├─────────────────────────────────────────────────────────────────┤
│  Top 10 Hot Rooms                    Connection Health          │
│  ┌────────────────────┐          ┌────────────────────┐       │
│  │ room-live-001  95W │          │ Healthy:  12       │       │
│  │ room-live-002  67W │          │ Warning:  0       │       │
│  │ room-chat-001  23W │          │ Critical: 0       │       │
│  └────────────────────┘          └────────────────────┘       │
├─────────────────────────────────────────────────────────────────┤
│  Message Loss Rate                  Stream Status               │
│  ┌────────────────────┐          ┌────────────────────┐       │
│  │ 0.12%              │          │ Active:  125       │       │
│  │ [正常]            │          │ Token/s: 12,543    │       │
│  └────────────────────┘          └────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 连接健康仪表盘

```
┌─────────────────────────────────────────────────────────────────┐
│  Connection Health                    Node: node-03            │
├─────────────────────────────────────────────────────────────────┤
│  Connection Distribution by Type                                  │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ WebSocket: ████████████████████████████████████  85%   │     │
│  │ SSE:       ████████                                  12%   │     │
│  │ LongPoll:  ███                                       3%   │     │
│  └──────────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│  Connection Events Timeline                                      │
│  [连接建立]▁▂▃▂▁▁▂▃▄▅▆▇▅▃▂▁▁▂▃▂▁▁▁▂▃▄▅▇█▇▅▃▂                  │
│                ▲                                                │
│              连接抖动（某时刻集中断连）                          │
├─────────────────────────────────────────────────────────────────┤
│  Disconnect Reasons                                             │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ heartbeat_timeout: ████████████████████  45%            │     │
│  │ client_close:       ████████████████     35%            │     │
│  │ network_error:      ████████               15%          │     │
│  │ server_error:       ██                       5%          │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 日志聚合与查询

### 日志存储架构（同 API Gateway）

```
网关节点 → Fluent Bit → Kafka → Elasticsearch/Loki → Kibana/Grafana
```

### 关键日志查询

```
# 查找用户的所有连接事件
{realtime_connection_log}
  | user_id = "user-001"
  | time_range = "last 7d"

# 查找消息丢失事件
{realtime_message_log}
  | status != "delivered"
  | time_range = "last 1h"

# 查找心跳超时导致的断连
{realtime_connection_log}
  | close_reason = "heartbeat_timeout"
  | time_range = "last 30m"
  | group_by(user_id, node_id)

# 查找热点房间的消息峰值
{realtime_message_log}
  | group_by(to_room_id)
  | sort_desc(count)
  | time_range = "last 1h"
```

---

## 7. SLO / SLA 监控

### SLO 定义

| SLO | 目标 | 测量窗口 |
|-----|------|----------|
| 连接可用性 | 99.95%（年断连 < 4.4h）| 30d 滚动 |
| 消息送达率 | 99.9% | 30d 滚动 |
| 消息送达延迟 P99 | < 100ms | 30d 滚动 |
| 重连恢复时间 | < 3s | 30d 滚动 |

### 错误预算监控

```
Error Budget = (1 - SLO Target) × Total Messages

例如：30 天消息总量 = 10^12 条
SLO: 99.9% 送达
Error Budget = 0.1% × 10^12 = 10^9 条消息允许丢失

消耗速率监控：
  - 过去 1h 丢失消息 = 1000 条
  - 预计 30d 消耗 = 1000 × 24 × 30 = 720,000 条
  - 消耗率 = 720,000 / 10^9 = 0.072%

如果消耗率 > 50%，触发 SLO 告警
```
