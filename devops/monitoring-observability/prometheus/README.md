# Prometheus Monitoring

## 目标

训练 Prometheus 监控体系：指标类型、PromQL、ServiceMonitor、AlertManager、Grafana 看板。

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Metric | 指标（name + labels + value） |
| Time Series | 时间序列数据 |
| PromQL | Prometheus 查询语言 |
| Exporter | 暴露指标的代理 |
| ServiceMonitor | 自动发现服务 |
| AlertRule | 告警规则 |
| Recording Rule | 预计算指标 |

## 指标类型

| 类型 | 说明 | 例子 |
| --- | --- | --- |
| Counter | 只增不减 | 请求数、错误数 |
| Gauge | 可增可减 | CPU使用率、内存 |
| Histogram | 分布桶 | 请求延迟分布 |
| Summary | 分位数 | P50/P90/P99 |

## 应用埋点

### Node.js (prom-client)

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

const register = new Registry();

// 请求计数器
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

// 请求延迟直方图
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// 当前活跃请求数
const httpActiveRequests = new Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests',
  registers: [register],
});

// 中间件
function metricsMiddleware(req, res, next) {
  httpActiveRequests.inc();
  const start = Date.now();

  res.on('finish', () => {
    httpActiveRequests.dec();
    const duration = (Date.now() - start) / 1000;

    httpRequestsTotal.inc({
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode,
    });

    httpRequestDuration.observe({
      method: req.method,
      path: req.route?.path || req.path,
    }, duration);
  });

  next();
}

// /metrics 端点
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Go (prometheus/client_golang)

```go
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    httpRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total HTTP requests",
        },
        []string{"method", "path", "status"},
    )

    httpRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "HTTP request duration",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "path"},
    )

    activeRequests = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "http_active_requests",
            Help: "Number of active requests",
        },
    )
)

func init() {
    prometheus.MustRegister(httpRequestsTotal, httpRequestDuration, activeRequests)
}

// Handler wrapper
func metricsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        activeRequests.Inc()
        defer activeRequests.Dec()

        start := time.Now()
        next.ServeHTTP(w, r)

        duration := time.Since(start).Seconds()
        httpRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "200").Inc()
        httpRequestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(duration)
    })
}

// Metrics endpoint
http.Handle("/metrics", promhttp.Handler())
```

## Prometheus 配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

rule_files:
  - "/etc/prometheus/rules/*.yml"

scrape_configs:
  # Prometheus 自身
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Kubernetes Pod 监控
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
```

## Alert Rules

```yaml
# rules/app-alerts.yml
groups:
  - name: myapp
    rules:
      # High Error Rate
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total[5m])) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # Latency High
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "P95 latency is {{ $value }}s"

      # No Traffic
      - alert: NoTraffic
        expr: sum(rate(http_requests_total[5m])) == 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "No traffic to application"

      # Pod Down
      - alert: PodDown
        expr: up{job="kubernetes-pods"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Pod is down"
```

## ServiceMonitor（K8s 自动发现）

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp
  labels:
    release: prometheus  # 必须匹配 Prometheus 的 serviceMonitorSelector
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
    - port: metrics
      path: /metrics
      interval: 15s
  namespaceSelector:
    matchNames:
      - production
```

## Prometheus Operator

```yaml
apiVersion: monitoring.coreos.com/v1
kind: Prometheus
metadata:
  name: prometheus
spec:
  serviceAccountName: prometheus
  serviceMonitorSelector:
    matchLabels:
      release: prometheus
  ruleSelector:
    matchLabels:
      team: platform
  alerting:
    alertmanagers:
      - namespace: monitoring
        name: alertmanager-main
```

## PromQL 示例

```promql
# QPS
rate(http_requests_total[5m])

# 错误率
sum(rate(http_requests_total{status=~"5.."}[5m]))
  /
sum(rate(http_requests_total[5m]))

# P95 延迟
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# CPU 使用率
sum(rate(container_cpu_usage_seconds_total{name=~".+"}[5m])) by (name)

# 内存使用
container_memory_usage_bytes{name=~".+"} / 1024 / 1024

# 独立指标组合
label_replace(
  sum(rate(http_requests_total[5m])) by (service),
  "service",
  "$1",
  "service",
  "(.*)"
)
```

## Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Application Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "P99 Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P99"
          }
        ]
      }
    ]
  }
}
```

## 四个黄金信号

| 信号 | 指标 | 告警阈值建议 |
| --- | --- | --- |
| Latency | P50/P95/P99 | P99 > 1s |
| Traffic | QPS | 异常波动 |
| Errors | 5xx 比例 | > 1% |
| Saturation | CPU/内存 | > 80% |

## 面试追问

- Prometheus 和 DataDog 的区别？
  （答：Prometheus 是开源、pull 模型、时序数据库；DataDog 是 SaaS、push 模型、更易用）
- 如何避免监控影响业务？
  （答：采样、异步上报、资源限制）
- Histogram 和 Summary 的区别？
  （答：Histogram 服务端计算、需要预定义 buckets；Summary 客户端计算、无法聚合）

## 相关模式

- `kubernetes/`：K8s 部署
- `deployment-strategies/`：部署时监控
- `incident-management/`：告警响应