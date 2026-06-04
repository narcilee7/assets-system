# Observability

## 三大支柱

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    日志      │    │    指标      │    │    链路      │
│  (Logs)      │    │  (Metrics)   │    │  (Traces)    │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ 结构化 JSON   │    │ Prometheus   │    │ OpenTelemetry│
│ 全量请求     │    │ P99/P999     │    │ Trace ID     │
│ 错误堆栈     │    │ 错误率       │    │ Span 串联    │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 1. 日志（Logs）

### 请求日志（Access Log）

每个请求一条结构化日志：

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "trace_id": "trace-01HV3WWZP",
  "span_id": "span-01HV3WWZP-01",

  "method": "POST",
  "path": "/api/v1/orders",
  "path_template": "/api/v1/orders",
  "query": "debug=true",
  "request_size": 1234,

  "remote_ip": "1.2.3.4",
  "x_forwarded_for": "1.2.3.4, 10.0.0.1",
  "user_agent": "Mozilla/5.0 ...",
  "tls_version": "TLS1.3",

  "user_id": "u12345",
  "tenant_id": "tenant-ecommerce",
  "consumer_id": "app-mobile",

  "route_name": "order-service-create",
  "backend_service": "order-service",
  "backend_addr": "10.0.1.5:8080",
  "backend_latency_ms": 45,

  "status_code": 201,
  "response_size": 5678,
  "total_latency_ms": 52,

  "gateway_node": "gw-node-03",
  "gateway_region": "cn-north-1",

  "plugins_executed": ["ip_whitelist", "cors", "jwt_auth", "rate_limit"],
  "plugin_total_latency_ms": 3,

  "circuit_breaker_state": "closed",

  "request_at": "2024-06-01T10:00:00.123Z",
  "response_at": "2024-06-01T10:00:00.175Z",

  "error_msg": null
}
```

### 错误日志（Error Log）

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "error_msg": "Rate limit exceeded for user_id=u12345 on route order-service-create",
  "error_stack": "at RateLimitPlugin.Check .../plugin.go:123",

  "user_id": "u12345",
  "route_name": "order-service-create",

  "rate_limit_config": {
    "limit": 1000,
    "window": "1m",
    "dimension": "user_id",
    "current": 1001
  },

  "gateway_node": "gw-node-03",
  "occurred_at": "2024-06-01T10:00:00.175Z"
}
```

### 插件执行日志

```json
{
  "request_id": "req-01HV3WWZP",
  "plugin_name": "jwt_auth",
  "plugin_phase": "pre",
  "plugin_duration_us": 450,
  "plugin_result": "success",
  "claims_extracted": {
    "user_id": "u12345",
    "roles": ["customer"],
    "tenant_id": "tenant-ecommerce"
  }
}
```

---

## 2. 指标（Metrics）

### 核心指标（Prometheus Format）

```prometheus
# 吞吐量
gateway_requests_total{route="$route", method="$method", status_code="$code", gateway="$node"} 123456
gateway_requests_rate{route="$route", quantile="0.99"} 9523.5

# 延迟分布
gateway_request_duration_seconds{route="$route", quantile="0.5"} 0.003
gateway_request_duration_seconds{route="$route", quantile="0.9"} 0.008
gateway_request_duration_seconds{route="$route", quantile="0.99"} 0.015
gateway_request_duration_seconds{route="$route", quantile="0.999"} 0.050

# 后端延迟
gateway_backend_duration_seconds{service="$service", quantile="0.99"} 0.045
gateway_backend_errors_total{service="$service", error_type="timeout"} 12
gateway_backend_errors_total{service="$service", error_type="connection_refused"} 3

# 限流
gateway_ratelimit_allowed_total{route="$route", dimension="$dim"} 952300
gateway_ratelimit_rejected_total{route="$route", dimension="$dim"} 4700
gateway_ratelimit_rejected_rate{route="$route"} 0.0049

# 熔断器
gateway_circuit_breaker_state{service="$service"} 0  # 0=closed,1=open,2=half_open
gateway_circuit_breaker_transitions_total{service="$service", from="closed", to="open"} 2

# 认证
gateway_auth_success_total{tenant_id="$tenant"} 95000
gateway_auth_failure_total{tenant_id="$tenant", reason="token_expired"} 120
gateway_auth_failure_total{tenant_id="$tenant", reason="invalid_signature"} 30

# 连接池
gateway_backend_connections_active{service="$service"} 245
gateway_backend_connections_idle{service="$service"} 55
gateway_backend_connections_waiting_total{service="$service"} 12

# 资源
gateway_memory_bytes{gateway="$node"} 524288000
gateway_cpu_seconds_total{gateway="$node"} 1234.5
gateway_go_goroutines{gateway="$node"} 850
```

### 路由维度聚合

```prometheus
# 按路由维度的 P99 延迟（Top 20 慢路由）
topk(20,
  gateway_request_duration_seconds{quantile="0.99"}
  sort_desc
)
```

---

## 3. 链路追踪（Distributed Tracing）

### OpenTelemetry 集成

#### Trace 上下文传播

```
请求进入网关
  │
  ▼
生成 Trace ID（如果请求中不存在）
  │ 格式：64-bit trace_id = gateway_id[16bits] + timestamp[32bits] + random[16bits]
  │
  ▼
提取或生成 Span ID
  │
  ▼
在插件链中创建子 Span
  │ 每个插件执行 → 一个子 Span
  │ 插件名作为 span name
  │
  ▼
后端调用时注入 Header
  │ Header: traceparent: 00-{trace_id}-{span_id}-{flags}
  │
  ▼
响应时结束根 Span
```

#### Span 结构

```go
// 请求处理根 Span
rootSpan := tracer.StartSpan("gateway.request")
rootSpan.SetAttributes(
    attribute.String("http.method", "POST"),
    attribute.String("http.route", "/api/v1/orders"),
    attribute.String("http.status_code", "201"),
    attribute.Int64("http.request_size", 1234),
)
defer rootSpan.End()

// 插件 Span
for _, plugin := range plugins {
    pluginSpan := tracer.StartSpan("plugin." + plugin.Name,
        otel.TracerOption.WithParent(rootSpan))
    pluginSpan.SetAttributes(
        attribute.String("plugin.name", plugin.Name),
    )
    plugin.Execute(ctx)
    pluginSpan.End()
}
```

#### 多后端调用的并行追踪

```go
// 同时调用多个后端（fan-out）
span := tracer.StartSpan("backend.fanout")

// 并行调用 user-service 和 product-service
var wg sync.WaitGroup
results := make([]interface{}, 2)

wg.Add(2)
go func() {
    span1 := tracer.StartSpan("user-service.GetUser",
        otel.TracerOption.WithParent(span))
    defer span1.End()
    results[0] = userClient.GetUser(ctx, userID)
    wg.Done()
}()

go func() {
    span2 := tracer.StartSpan("product-service.GetProducts",
        otel.TracerOption.WithParent(span))
    defer span2.End()
    results[1] = productClient.GetProducts(ctx, productIDs)
    wg.Done()
}()

wg.Wait()
```

---

## 4. 告警规则

### 核心告警

| 告警名称 | 条件 | 严重程度 | 说明 |
|----------|------|----------|------|
| **GatewayHighLatency** | P99 > 50ms，持续 5min | P2 | 网关自身慢 |
| **GatewayBackendHighLatency** | 后端 P99 > 2s，持续 5min | P2 | 后端响应慢 |
| **HighErrorRate** | 5xx 错误率 > 1%，持续 2min | P1 | 后端可能故障 |
| **CircuitBreakerOpen** | 任意服务熔断器打开 | P2 | 后端服务异常 |
| **RateLimitHighTriggerRate** | 限流触发率 > 5% | P2 | 可能是攻击 |
| **AuthFailureRate** | 认证失败率 > 10% | P2 | 可能是凭证泄露 |
| **BackendPoolExhausted** | 连接池使用率 > 90% | P1 | 后端过载 |
| **GatewayNodeDown** | 任意网关节点不健康 | P1 | 网关节点故障 |
| **RedisUnavailable** | Redis 不可用 > 30s | P1 | 限流/会话失效 |
| **JWKSRefreshFailed** | JWKS 刷新连续失败 > 3次 | P2 | JWT 验证受影响 |

### 告警配置示例（Alertmanager）

```yaml
groups:
  - name: gateway_alerts
    rules:
      - alert: GatewayHighLatency
        expr: |
          histogram_quantile(0.99,
            rate(gateway_request_duration_seconds_bucket[5m])
          ) > 0.050
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "网关延迟过高"
          description: "网关 P99 延迟 {{ $value }}s，超过 50ms 阈值"

      - alert: CircuitBreakerOpen
        expr: gateway_circuit_breaker_state == 1
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "熔断器打开: {{ $labels.service }}"
          description: "服务 {{ $labels.service }} 熔断器已打开，后端请求快速失败"
```

---

## 5. 仪表盘（Dashboards）

### 网关概览仪表盘（Grafana）

```
┌─────────────────────────────────────────────────────────────────┐
│  Gateway Overview                    Region: CN-North-1        │
├─────────────────────────────────────────────────────────────────┤
│  QPS                    Error Rate        P99 Latency           │
│  ┌─────────┐           ┌─────────┐        ┌─────────┐           │
│  │ 95,234  │           │  0.42%  │        │   12ms  │           │
│  └─────────┘           └─────────┘        └─────────┘           │
│                                                                  │
│  [请求量趋势图]           [延迟分布图]         [错误率图]         │
│  ████████████           ▁▂▃▅▇█▇▅▃▂▁        ▁▁▁▁▂▂▃▄▄▅▆         │
├─────────────────────────────────────────────────────────────────┤
│  Top 10 Slow Routes                 Top 10 Error Routes          │
│  ┌────────────────────┐          ┌────────────────────┐         │
│  │ /api/v1/search  89ms │          │ /api/v1/pay   2.3% │         │
│  │ /api/v1/recommend 67ms│          │ /api/v1/orders 0.8%│         │
│  └────────────────────┘          └────────────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│  Circuit Breaker Status                                            │
│  [order-service] [payment-service] [inventory-service]            │
│     CLOSED          HALF_OPEN            CLOSED                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 日志聚合与查询

### 日志存储架构

```
网关节点
  │
  ├── 日志写入本地文件（JSON Lines）
  │
  ▼
Fluent Bit / Filebeat（轻量级日志收集器）
  │ 读取本地日志文件
  │ 附加节点元信息（hostname、region、ip）
  │
  ▼
Kafka（缓冲 + 分区）
  │ Topic: gateway-access-logs
  │ Partition: by tenant_id（保证同一租户日志有序）
  │
  ▼
Elasticsearch / Loki（日志存储 + 查询）
  │
  ▼
Kibana / Grafana Loki（可视化查询）
```

### 日志查询示例

```
# 查询某用户的所有请求
{gateway_access_log}
  | user_id = "u12345"
  | time_range = "last 1h"

# 查询高延迟请求（> 1s）
{gateway_access_log}
  | total_latency_ms > 1000
  | status_code >= 200
  | time_range = "last 30m"

# 查询限流触发事件
{gateway_error_log}
  | error_code = "RATE_LIMIT_EXCEEDED"
  | time_range = "last 1h"
  | group_by(user_id, route_name)
```

---

## 7. SLO / SLA 监控

### SLO 定义

| SLO | 目标 | 测量窗口 |
|-----|------|----------|
| 可用性 | 99.99%（年停机 < 52min） | 30d 滚动 |
| P99 延迟 | < 50ms | 30d 滚动 |
| P999 延迟 | < 200ms | 30d 滚动 |
| 错误率（5xx） | < 0.1% | 30d 滚动 |

### 错误预算监控

```
Error Budget = (1 - SLO Target) × Total Requests

SLO: 99.99% 可用性
30 天总请求 = 30 × 24 × 3600 × 95000 ≈ 2.46 × 10^11 请求
Error Budget = 0.01% × 2.46 × 10^11 = 2.46 × 10^7 ≈ 2460 万个错误

当前错误消耗速率：
  - 过去 1h 错误数 = 450
  - 预计 30d 消耗 = 450 × 24 × 30 = 324,000 错误
  - 消耗率 = 324,000 / 24,600,000 = 1.3%

如果消耗率 > 50%，触发 SLO 告警，要求紧急修复
```
