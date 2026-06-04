# Observability

## 三大支柱

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    日志      │    │    指标      │    │    链路      │
│  (Logs)      │    │  (Metrics)   │    │  (Traces)    │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ 上传事件     │    │ 速度/进度   │    │ 分片上传链   │
│ 分片状态     │    │ 成功率     │    │ 合并流程     │
│ 错误堆栈     │    │ 延迟分布    │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 1. 日志（Logs）

### 上传初始化日志

```json
{
  "event": "upload.initiated",
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "file_id": "file-abc123",
  "user_id": "u12345",
  "file_name": "large_video.mp4",
  "file_size": 10737418240,
  "file_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0",
  "chunk_size": 5242880,
  "total_chunks": 2048,
  "timestamp": "2024-06-01T10:00:00.000Z"
}
```

### 分片上传日志

```json
{
  "event": "upload.chunk_completed",
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "chunk_index": 0,
  "chunk_size": 5242880,
  "chunk_hash": "md5:e8b5c3d2",
  "duration_ms": 1234,
  "speed_mbps": 34.2,
  "timestamp": "2024-06-01T10:00:05.000Z"
}
```

### 分片失败日志

```json
{
  "event": "upload.chunk_failed",
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "chunk_index": 15,
  "error_code": "TIMEOUT",
  "error_message": "request timeout after 30s",
  "attempts": 3,
  "timestamp": "2024-06-01T10:01:30.000Z"
}
```

### 秒传日志

```json
{
  "event": "upload.instant_success",
  "user_id": "u12345",
  "file_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0",
  "file_id": "file-abc123",
  "file_size": 10737418240,
  "saved_bytes": 10737418240,
  "timestamp": "2024-06-01T10:00:00.500Z"
}
```

### 合并日志

```json
{
  "event": "upload.merged",
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "file_id": "file-abc123",
  "total_chunks": 2048,
  "merged_chunks": 2048,
  "final_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0",
  "duration_ms": 45678,
  "timestamp": "2024-06-01T10:05:00.000Z"
}
```

### Hash 不一致日志

```json
{
  "event": "upload.hash_mismatch",
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "expected_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0",
  "actual_hash": "md5:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5",
  "mismatch_type": "final_hash",
  "timestamp": "2024-06-01T10:05:30.000Z"
}
```

---

## 2. 指标（Metrics）

### 上传吞吐量

```prometheus
# 上传请求量
upload_requests_total{status="success"} 123456
upload_requests_total{status="failed"} 234

# 上传速度（客户端）
upload_speed_mbps{quantile="0.5"} 34.2
upload_speed_mbps{quantile="0.9"} 56.8
upload_speed_mbps{quantile="0.99"} 89.3

# 上传延迟（服务端）
upload_init_duration_seconds{quantile="0.99"} 0.023
upload_merge_duration_seconds{quantile="0.99"} 45.6
```

### 分片上传指标

```prometheus
# 分片上传量
chunk_uploads_total{status="success"} 12345678
chunk_uploads_total{status="failed"} 12345

# 分片上传延迟
chunk_upload_duration_seconds{quantile="0.5"} 1.2
chunk_upload_duration_seconds{quantile="0.9"} 2.3
chunk_upload_duration_seconds{quantile="0.99"} 5.6

# 分片大小分布
chunk_size_bytes{quantile="0.5"} 5242880
chunk_size_bytes{quantile="0.99"} 5242880
```

### 秒传指标

```prometheus
# 秒传请求
instant_upload_requests_total{result="hit"} 34567
instant_upload_requests_total{result="miss"} 78901

# 秒传命中率
instant_upload_hit_rate 0.304

# 秒传节省的带宽
instant_upload_bandwidth_saved_bytes 536870912000
```

### 文件合并指标

```prometheus
# 合并任务
merge_tasks_total{status="success"} 8901
merge_tasks_total{status="failed"} 23
merge_tasks_total{status="pending"} 12

# 合并延迟
merge_duration_seconds{quantile="0.5"} 34.5
merge_duration_seconds{quantile="0.9"} 67.8
merge_duration_seconds{quantile="0.99"} 123.4

# 合并文件大小
merge_file_size_bytes{quantile="0.5"} 1073741824
merge_file_size_bytes{quantile="0.99"} 10737418240
```

### Hash 校验指标

```prometheus
# Hash 计算时间（客户端）
client_hash_duration_seconds{quantile="0.5"} 12.3
client_hash_duration_seconds{quantile="0.99"} 45.6

# Hash 不一致错误
hash_mismatch_total{type="chunk"} 12
hash_mismatch_total{type="final"} 3
```

---

## 3. 链路追踪（Distributed Tracing）

### 上传请求 Trace

```
Trace: trace-01HV3WWZP

Root Span: upload.init
  │
  ├── Span: hash.compute (client)
  │     latency: 12.3s
  │
  ├── Span: instant.check
  │     latency: 23ms
  │
  ├── Span: upload.init
  │     latency: 45ms
  │
  └── Span: chunk.upload (parallel, 3 chunks)
        │
        ├── Span: chunk[0].upload
        │     latency: 2.3s
        ├── Span: chunk[1].upload
        │     latency: 2.1s
        └── Span: chunk[2].upload
              latency: 2.4s
```

### 合并请求 Trace

```
Span: upload.merge
  │
  ├── Span: verify.chunks
  │     latency: 123ms
  │
  ├── Span: merge.streaming
  │     latency: 45678ms
  │
  ├── Span: verify.final_hash
  │     latency: 234ms
  │
  └── Span: cleanup.chunks
        latency: 567ms
```

---

## 4. 告警规则

### 核心告警

| 告警名称 | 条件 | 严重程度 | 说明 |
|----------|------|----------|------|
| **HighUploadFailureRate** | 上传失败率 > 5% | P2 | 上传服务质量下降 |
| **HighChunkFailureRate** | 分片失败率 > 1% | P2 | 网络或服务端问题 |
| **HashMismatchError** | Hash 不一致错误 > 0 | P1 | 数据损坏 |
| **MergeFailureRate** | 合并失败率 > 1% | P1 | 合并服务问题 |
| **LowInstantUploadRate** | 秒传命中率 < 20% | P3 | 热门文件复用率低 |
| **StorageNearCapacity** | 存储使用率 > 70% | P1 | 存储容量预警 |
| **SlowMergeDuration** | 合并延迟 P99 > 120s | P2 | 大文件合并慢 |

### 告警配置示例

```yaml
groups:
  - name: upload_alerts
    rules:
      - alert: HighUploadFailureRate
        expr: |
          rate(upload_requests_total{status="failed"}[5m]) /
          rate(upload_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "上传失败率过高"
          description: "上传失败率 {{ $value | humanizePercentage }}，超过 5% 阈值"

      - alert: HashMismatchError
        expr: |
          increase(hash_mismatch_total[1h]) > 0
        labels:
          severity: critical
        annotations:
          summary: "文件 Hash 校验失败"
          description: "过去 1 小时发生 {{ $value }} 次 Hash 不一致错误，需要立即检查"

      - alert: MergeFailureRate
        expr: |
          rate(merge_tasks_total{status="failed"}[5m]) /
          rate(merge_tasks_total[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "合并失败率过高"
          description: "合并失败率 {{ $value | humanizePercentage }}，超过 1% 阈值"
```

---

## 5. 仪表盘（Grafana）

### 上传概览仪表盘

```
┌─────────────────────────────────────────────────────────────────┐
│  Upload Overview                     Region: CN-North-1            │
├─────────────────────────────────────────────────────────────────┤
│  Uploads/sec    Success Rate   Avg Speed    Instant Rate         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │  1,234     │ │   98.7%    │ │  34.2Mbps  │ │   30.4%    │ │
│  │  +5.2%     │ │  [正常]    │ │  [正常]    │ │  [正常]    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                              │
│  [上传量趋势]         [成功率趋势]      [速度分布]            │
│  ████████████         ▁▁▁▁▁▁▂▃▄▅▆     ▁▁▁▂▂▃▄▅▆              │
├─────────────────────────────────────────────────────────────────┤
│  Chunk Upload Status              Merge Status                   │
│  ┌────────────────────┐        ┌────────────────────┐       │
│  │ Active:  5,234     │        │ Success:   8,901   │       │
│  │ Pending: 12,345    │        │ Failed:       23   │       │
│  │ Failed:    123     │        │ Pending:      12   │       │
│  └────────────────────┘        └────────────────────┘       │
├─────────────────────────────────────────────────────────────────┤
│  Storage Usage                                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Used: 35TB / 100TB ████████████░░░░░░░░░░░░░░░░  35%   │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 日志聚合与查询

### 日志存储架构

```
上传服务节点
  │
  ├── 结构化日志（JSON Lines）
  │    - upload_id, chunk_index, user_id, duration
  │
  ▼
Fluent Bit / OTel Collector
  │
  ▼
Kafka（缓冲）
  │ Topic: upload-logs
  │ Partition: by upload_id
  │
  ▼
Elasticsearch / ClickHouse
  │
  ▼
Grafana / Kibana
```

### 关键日志查询

```
# 查询某上传任务的完整流程
{upload_logs}
  | upload_id = "upload-01HV3WWZP..."
  | order by timestamp

# 查询分片失败率
{upload_logs}
  | event = "upload.chunk_failed"
  | group by error_code
  | time_range = "last 1h"

# 查询 Hash 不一致错误
{upload_logs}
  | event = "upload.hash_mismatch"
  | time_range = "last 24h"

# 查询大文件合并延迟
{upload_logs}
  | event = "upload.merged"
  | file_size > 10 * 1024 * 1024 * 1024
  | group by duration_ms
  | sort_desc
  | time_range = "last 1h"
```

---

## 7. SLO / SLA 监控

### SLO 定义

| SLO | 目标 | 测量窗口 |
|-----|------|----------|
| 上传成功率 | > 99% | 30d 滚动 |
| 分片上传成功率 | > 99.5% | 30d 滚动 |
| 秒传命中率 | > 30% | 30d 滚动 |
| 合并成功率 | > 99.9% | 30d 滚动 |
| Hash 一致率 | > 99.99% | 30d 滚动 |

### 错误预算监控

```
Error Budget = (1 - SLO Target) × Total Uploads

例如：30 天总上传 = 10^7 次
SLO: 上传成功率 > 99%
Error Budget = 1% × 10^7 = 10^5 次失败

消耗速率监控：
  - 过去 1h 失败数 = 100
  - 预计 30d 消耗 = 100 × 24 × 30 = 72,000
  - 消耗率 = 72,000 / 100,000 = 72%

如果消耗率 > 50%，触发 SLO 告警
```
