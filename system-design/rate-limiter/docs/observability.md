# Observability

## Metrics

### 核心指标

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `ratelimit_requests_total` | Counter | resource, dimension, result(allowed/rejected) | 限流请求总数 |
| `ratelimit_decision_latency_ms` | Histogram | resource, algorithm | 限流判断延迟 |
| `ratelimit_remaining_ratio` | Gauge | resource, dimension | 剩余配额比例 |
| `ratelimit_redis_errors_total` | Counter | operation, error_type | Redis 操作错误 |
| `ratelimit_rules_loaded` | Gauge | - | 当前加载的规则数 |
| `ratelimit_cache_hit_ratio` | Gauge | cache_level(l1/l2) | 缓存命中率 |

### 关键告警规则

```yaml
alerts:
  - name: RateLimitHighRejection
    expr: rate(ratelimit_requests_total{result="rejected"}[1m]) > 1000
    for: 1m
    severity: warning
    summary: "{{ $labels.resource }} 限流拒绝率过高"

  - name: RateLimitRedisDown
    expr: rate(ratelimit_redis_errors_total[1m]) > 10
    for: 30s
    severity: critical
    summary: "Redis 限流存储异常"

  - name: RateLimitDecisionLatencyHigh
    expr: histogram_quantile(0.99, rate(ratelimit_decision_latency_ms_bucket[5m])) > 5
    for: 2m
    severity: warning
    summary: "限流判断 P99 延迟超过 5ms"
```

## Logs

### 结构化日志

```json
{
  "level": "warn",
  "ts": "2024-06-04T12:00:00Z",
  "msg": "rate limit triggered",
  "resource": "api:order:create",
  "dimension": "user_id=u12345",
  "algorithm": "token_bucket",
  "limit": 100,
  "window": "1m",
  "trace_id": "abc123"
}
```

### 日志级别

- **Debug**：每次限流判断的详细参数（采样 1%）
- **Info**：规则加载/卸载、配置变更
- **Warn**：限流触发、Redis 降级
- **Error**：Redis 持久化失败、规则解析错误

## Traces

在限流判断节点注入 span：

```
[HTTP Request] 
  └── [ratelimit.check] 
        ├── [rule.match] 2μs
        ├── [local.check] 1μs
        └── [redis.eval] 500μs (optional)
```

Trace Attributes：
- `ratelimit.resource`
- `ratelimit.algorithm`
- `ratelimit.result`
- `ratelimit.remaining`

## Dashboard

### 核心面板

1. **限流大盘**：各 resource 的允许/拒绝 QPS 趋势
2. **延迟分布**：P50/P95/P99 判断延迟
3. **配额使用**：TOP10 资源维度的配额消耗率
4. **Redis 健康**：连接数、错误率、命令延迟
5. **规则覆盖**：生效规则数、规则变更历史
