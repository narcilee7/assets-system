# Observability

## 三大支柱

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    日志      │    │    指标      │    │    链路      │
│  (Logs)      │    │  (Metrics)   │    │  (Traces)    │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ 缓存操作     │    │ 命中率       │    │ 请求路径     │
│ 异常错误     │    │ 延迟分布     │    │ Cache/Db 调用│
│ 淘汰/过期    │    │ 内存/QPS     │    │ 瓶颈识别     │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 1. 日志（Logs）

### 缓存操作日志

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "event": "cache.get",
  "key": "user:profile:u12345",
  "layer": "l1",
  "hit": true,
  "latency_us": 12,
  "node": "node-03"
}
```

```json
{
  "event": "cache.get",
  "key": "user:profile:u12345",
  "layer": "l2",
  "hit": true,
  "latency_us": 230,
  "node": "node-03"
}
```

```json
{
  "event": "cache.get",
  "key": "user:profile:u67890",
  "layer": "l2",
  "hit": false,
  "latency_us": 1250,
  "fallback": "mysql",
  "node": "node-03"
}
```

### 缓存写入日志

```json
{
  "event": "cache.set",
  "key": "user:profile:u12345",
  "ttl_seconds": 3600,
  "value_size": 512,
  "latency_us": 145,
  "node": "node-03"
}
```

```json
{
  "event": "cache.delete",
  "key": "user:profile:u12345",
  "reason": "write_behind",
  "latency_us": 89,
  "node": "node-03"
}
```

### 缓存淘汰日志

```json
{
  "event": "cache.evict",
  "key": "user:profile:u99999",
  "eviction_policy": "lru",
  "reason": "memory_threshold",
  "ttl_remaining_seconds": 1234,
  "node": "node-03"
}
```

### 缓存异常日志

```json
{
  "event": "cache.error",
  "error_type": "redis_timeout",
  "key": "user:profile:u12345",
  "error_msg": "connection timeout after 2s",
  "node": "node-03",
  "occurred_at": "2024-06-01T10:00:00.000Z"
}
```

---

## 2. 指标（Metrics）

### 命中率

```prometheus
# 分层命中率
cache_hits_total{layer="l1"} 9523456
cache_misses_total{layer="l1"} 123456
cache_hit_rate{layer="l1"} 0.987

cache_hits_total{layer="l2"} 8523456
cache_misses_total{layer="l2"} 1234567
cache_hit_rate{layer="l2"} 0.873

# 整体命中率（综合 L1 + L2）
cache_overall_hit_rate 0.952

# 穿透到 DB 的请求
db_fallback_total{model="read"} 567890
db_fallback_rate{model="read"} 0.048
```

### 延迟分布

```prometheus
# 缓存命中延迟
cache_get_latency_seconds{layer="l1", quantile="0.5"} 0.000012
cache_get_latency_seconds{layer="l1", quantile="0.9"} 0.000015
cache_get_latency_seconds{layer="l1", quantile="0.99"} 0.000020
cache_get_latency_seconds{layer="l1", quantile="0.999"} 0.000050

cache_get_latency_seconds{layer="l2", quantile="0.5"} 0.000230
cache_get_latency_seconds{layer="l2", quantile="0.9"} 0.000450
cache_get_latency_seconds{layer="l2", quantile="0.99"} 0.001000
cache_get_latency_seconds{layer="l2", quantile="0.999"} 0.005000

# DB 回源延迟
db_query_latency_seconds{quantile="0.5"} 0.005000
db_query_latency_seconds{quantile="0.9"} 0.015000
db_query_latency_seconds{quantile="0.99"} 0.030000
```

### Redis 指标

```prometheus
# Redis 内存
redis_memory_used_bytes 5368709120
redis_memory_max_bytes 17179869184
redis_memory_usage_ratio 0.312

# Redis 吞吐量
redis_ops_per_second 52345.5
redis_instantaneous_ops_per_second 52345

# Redis 连接
redis_connected_clients 125
redis_blocked_clients 0
redis_client_longest_output_buffer_bytes 1024

# Redis 命中率
redis_keyspace_hits 1234567890
redis_keyspace_misses 123456789
redis_keyspace_hit_rate 0.909

# Redis 淘汰和过期
redis_evicted_keys_total 12345
redis_expired_keys_total 67890
```

### 淘汰策略指标

```prometheus
# 淘汰原因
cache_eviction_total{reason="lru", reason_detail="memory_threshold"} 10000
cache_eviction_total{reason="ttl", reason_detail="natural_expire"} 5000

# 淘汰延迟
cache_eviction_latency_us{quantile="0.99"} 120
```

### 大 Key 指标

```prometheus
# 大 key 数量
redis_big_keys_total{type="string"} 12
redis_big_keys_total{type="hash"} 5
redis_big_keys_total{type="list"} 3

# 单个 key 最大大小
redis_max_key_size_bytes 10485760  # 10MB
```

### 热点 Key 指标

```prometheus
# 热点 key 访问频率（Top 10）
topk(10, cache_key_access_count)

# 热点 key 带宽占用
cache_key_bandwidth_bytes{key="product:detail:p98765"} 10485760  # 10MB/s
```

---

## 3. 链路追踪（Distributed Tracing）

### 缓存调用 Span

```go
// 缓存调用 Span
span := tracer.StartSpan("cache.get")
span.SetAttributes(
    attribute.String("cache.key", key),
    attribute.String("cache.layer", "l1"),
    attribute.Bool("cache.hit", hit),
)
defer span.End()
```

### 多级缓存 Trace

```
Trace: trace-01HV3WWZP

Span: cache.get (user:profile:u12345)
  │
  ├── Span: l1.get (l1 hit)      ← 本地缓存命中
  │     latency: 12μs
  │
  └── Span: cache.get completed   ← 返回结果

vs

Span: cache.get (user:profile:u67890)
  │
  ├── Span: l1.get (l1 miss)     ← 本地缓存未命中
  │     latency: 5μs
  │
  ├── Span: l2.get (l2 hit)       ← Redis 命中
  │     latency: 230μs
  │
  └── Span: l1.set (l1 fill)      ← 回填本地缓存
        latency: 10μs

vs

Span: cache.get (user:profile:u99999)
  │
  ├── Span: l1.get (l1 miss)     ← 本地缓存未命中
  │
  ├── Span: l2.get (l2 miss)      ← Redis 未命中
  │
  ├── Span: db.query             ← 查询 MySQL
  │     latency: 15ms
  │
  ├── Span: l2.set (l2 fill)      ← 回填 Redis
  │     latency: 500μs
  │
  └── Span: l1.set (l1 fill)     ← 回填本地缓存
        latency: 10μs
```

---

## 4. 告警规则

### 核心告警

| 告警名称 | 条件 | 严重程度 | 说明 |
|----------|------|----------|------|
| **CacheHitRateLow** | 整体命中率 < 90% | P1 | 缓存失效，需要检查 |
| **CacheHitRateCritical** | 整体命中率 < 80% | P2 | 严重问题，可能是大故障 |
| **RedisMemoryHigh** | 内存使用率 > 70% | P1 | 接近容量上限 |
| **RedisMemoryCritical** | 内存使用率 > 85% | P0 | 即将 OOM |
| **RedisEvictionHigh** | 淘汰数 > 1000/s | P2 | 可能有内存压力 |
| **CacheErrorRateHigh** | 错误率 > 1% | P1 | 缓存服务异常 |
| **HotKeyDetected** | 单 key QPS > 5W | P2 | 热 key 可能导致问题 |
| **BigKeyDetected** | 单 key > 10MB | P2 | 大 key 可能导致问题 |
| **RedisConnectionPressure** | 连接数 > 80% | P2 | 连接池可能耗尽 |

### 告警配置示例

```yaml
groups:
  - name: cache_alerts
    rules:
      - alert: CacheHitRateLow
        expr: |
          1 - (rate(cache_misses_total[5m]) / rate(cache_hits_total[5m] + cache_misses_total[5m])) < 0.90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "缓存命中率过低"
          description: "缓存命中率 {{ $value | humanizePercentage }}，低于 90% 阈值"

      - alert: RedisMemoryHigh
        expr: |
          redis_memory_used_bytes / redis_memory_max_bytes > 0.70
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis 内存使用率过高"
          description: "Redis 内存使用率 {{ $value | humanizePercentage }}，超过 70% 阈值"

      - alert: RedisEvictionHigh
        expr: |
          rate(redis_evicted_keys_total[5m]) > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis 淘汰速率过高"
          description: "Redis 每秒淘汰 {{ $value }} 个 key，超过 1000/s 阈值"

      - alert: BigKeyDetected
        expr: |
          redis_max_key_size_bytes > 10 * 1024 * 1024
        labels:
          severity: warning
        annotations:
          summary: "发现 Redis 大 key"
          description: "最大的 key 大小为 {{ $value | humanizeBytes }}，超过 10MB 阈值"
```

---

## 5. 仪表盘（Grafana）

### 缓存概览仪表盘

```
┌─────────────────────────────────────────────────────────────────┐
│  Cache Overview                      Region: CN-North-1        │
├─────────────────────────────────────────────────────────────────┤
│  Hit Rate (Overall)      Memory Usage        QPS                │
│  ┌─────────────┐        ┌─────────────┐     ┌─────────────┐     │
│  │   95.2%     │        │    31.2%    │     │   52,345    │     │
│  │  [正常]     │        │  [正常]     │     │  +5.2%      │     │
│  └─────────────┘        └─────────────┘     └─────────────┘     │
│                                                              │
│  [命中率趋势]         [内存使用趋势]       [QPS趋势]           │
│  ████████████         ▁▂▃▄▅▆▇█▇▅▃        ▁▁▁▁▁▂▃▄▅▆         │
├─────────────────────────────────────────────────────────────────┤
│  Layer Hit Rates                   Operations                  │
│  ┌────────────────────┐          ┌────────────────────┐         │
│  │ L1:  98.7%         │          │ GET:     52,345/s │         │
│  │ L2:  87.3%         │          │ SET:      1,234/s │         │
│  │ Overall: 95.2%    │          │ DEL:        234/s │         │
│  └────────────────────┘          └────────────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│  Top 10 Hot Keys                    Evictions                   │
│  ┌────────────────────┐          ┌────────────────────┐         │
│  │ 1. p98765   45,230 │          │ LRU:        1,234 │         │
│  │ 2. p98766   34,120 │          │ TTL:          567  │         │
│  │ 3. u12345   23,450 │          │ Total:     1,801  │         │
│  └────────────────────┘          └────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 日志聚合与查询

### 日志存储架构

```
应用节点 → Fluent Bit → Kafka → Elasticsearch/Loki → Grafana
```

### 关键日志查询

```
# 查询缓存命中率
{cache_operation_log}
  | group_by(layer)
  | hit_rate = hits / (hits + misses)
  | time_range = "last 1h"

# 查询 Redis 内存使用率
{redis_info_log}
  | key = "used_memory"
  | time_range = "last 24h"

# 查询大 key
{cache_operation_log}
  | value_size > 10 * 1024 * 1024
  | group_by(key, value_size)
  | sort_desc(value_size)
  | time_range = "last 1h"

# 查询缓存错误
{cache_error_log}
  | error_type = "timeout" | "oom" | "connection_error"
  | time_range = "last 30m"
  | group_by(error_type, count)
```

---

## 7. SLO / SLA 监控

### SLO 定义

| SLO | 目标 | 测量窗口 |
|-----|------|----------|
| 缓存命中率 | > 95% | 30d 滚动 |
| 缓存 P99 延迟 | < 2ms | 30d 滚动 |
| Redis 可用性 | 99.99% | 30d 滚动 |
| 内存使用率 | < 70% | 实时 |

### 错误预算监控

```
Error Budget = (1 - SLO Target) × Total Requests

例如：30 天总请求 = 10^12 次
SLO: 95% 命中率
Error Budget = 5% × 10^12 = 5 × 10^10 次未命中

消耗速率监控：
  - 过去 1h 未命中数 = 5 × 10^7
  - 预计 30d 消耗 = 5 × 10^7 × 24 × 30 = 3.6 × 10^10
  - 消耗率 = 3.6 × 10^10 / 5 × 10^10 = 72%

如果消耗率 > 50%，触发 SLO 告警
```
