# 日志系统

## 1. 日志设计原则

```
结构化日志 vs 非结构化日志

非结构化：
  2024-06-08 10:00:01 INFO User Alice logged in from 192.168.1.100
  → 难以查询、解析成本高

结构化（JSON）：
  {
    "timestamp": "2024-06-08T10:00:01.000Z",
    "level": "INFO",
    "event": "user.login",
    "user_id": "alice",
    "client_ip": "192.168.1.100",
    "method": "password",
    "duration_ms": 150,
    "request_id": "req-123",
    "trace_id": "trace-abc"
  }
  → 可索引、可查询、可聚合

日志级别
├── DEBUG：详细的调试信息，开发环境使用
├── INFO：常规操作信息，生产默认级别
├── WARNING：异常情况但服务可用
├── ERROR：功能失败，需要关注
├── CRITICAL：系统级故障，立即响应
└── 原则：生产环境不低于 INFO，关键路径记录所有级别

日志字段规范
├── timestamp：ISO 8601 格式，UTC
├── level：日志级别
├── service：服务名称
├── request_id：请求唯一标识
├── trace_id：追踪 ID
├── user_id：用户标识（如适用）
├── event：事件类型（统一枚举）
├── message：人类可读描述
├── 上下文字段：与事件相关的业务数据
└── 避免：密码、Token、信用卡号、PII
```

```python
# 结构化日志最佳实践
import structlog
import logging

# 配置
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.stdlib.ExtraAdder(),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# 使用 bound logger（上下文绑定）
logger = structlog.get_logger()

# 绑定请求上下文
request_logger = logger.bind(request_id="req-123", trace_id="trace-abc", user_id="alice")

# 记录事件
request_logger.info("request_started", method="GET", path="/api/users", client_ip="1.2.3.4")

# 记录完成
request_logger.info("request_completed",
    method="GET",
    path="/api/users",
    status_code=200,
    duration_ms=45,
    response_size=1024
)

# 记录错误
try:
    process_payment()
except PaymentError as e:
    request_logger.error("payment_failed",
        order_id="order-456",
        amount=100.00,
        currency="USD",
        error_code=e.code,
        error_message=str(e),
        retryable=e.retryable
    )
```

## 2. 日志收集架构

```
日志收集流水线

App ──▶ Log Agent ──▶ Log Aggregator ──▶ Storage ──▶ Query
 │         │              │                │           │
 │    Filebeat          Kafka/            Elasticsearch  Kibana
 │    Fluent Bit        Fluentd          / Loki          / Grafana
 │    Promtail          Vector           / ClickHouse
 │
stdout / file

部署模式：
├── DaemonSet（推荐）：每个节点一个 Agent，收集所有 Pod 日志
├── Sidecar：每个 Pod 一个 Agent，隔离性好但资源消耗大
└── 直接推送：应用直接发送到聚合器（简单但耦合）
```

| 方案 | 采集器 | 存储 | 查询 | 适用场景 |
|------|--------|------|------|----------|
| ELK | Filebeat/Logstash | Elasticsearch | Kibana | 全文搜索、复杂查询 |
| PLG | Promtail | Loki | Grafana | K8s 原生、轻量、成本低 |
| ClickHouse | Vector | ClickHouse | Grafana | 超大规模、低成本 |
| 云原生 | CloudWatch/Cloud Logging | 托管 | 托管 | 云环境、免运维 |

```yaml
# Promtail 配置（K8s）
server:
  http_listen_port: 9080

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_container_name]
        target_label: container
    pipeline_stages:
      - json:
          expressions:
            level: level
            message: message
            trace_id: trace_id
      - labels:
          level:
```

## 3. 日志采样与成本

```
日志成本控制策略
├── 采样：
│   ├── 全量记录 ERROR/CRITICAL
│   ├── 10% 采样 INFO
│   └── 1% 采样 DEBUG
├── 过滤：
│   ├── 丢弃健康检查日志
│   ├── 丢弃静态资源请求
│   └── 丢弃已知安全的内部调用
├── 压缩：
│   ├── 存储层压缩（GZIP/Snappy）
│   └── 归档到对象存储（S3/GCS）
├── 保留策略：
│   ├── 热存储：7 天（快速查询）
│   ├── 温存储：30 天（较慢查询）
│   └── 冷存储：1-2 年（合规归档）
└── 分片：
    ├── 按时间分片（日/周）
    └── 按服务分片
```

```python
# 日志采样实现
import random
import logging

class SamplingFilter(logging.Filter):
    def __init__(self, sample_rate=0.1):
        self.sample_rate = sample_rate

    def filter(self, record):
        # 错误 always 记录
        if record.levelno >= logging.ERROR:
            return True
        # 其他按概率采样
        return random.random() < self.sample_rate

# 配置
logger = logging.getLogger()
logger.addFilter(SamplingFilter(sample_rate=0.1))
```
