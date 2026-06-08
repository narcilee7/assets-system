# 分布式追踪

## 1. OpenTelemetry 核心概念

```
Trace 结构

Trace（一次请求的完整链路）
  └── Span A（服务 A 处理）
        ├── Span B（服务 B 处理）
        │     └── Span D（数据库查询）
        └── Span C（服务 C 处理）
              └── Span E（HTTP 调用）

Span 属性：
├── TraceID：全局唯一，标识整个链路
├── SpanID：当前 Span 唯一标识
├── ParentSpanID：父 Span 标识
├── Name：操作名称（如 "GET /api/users"）
├── StartTime / EndTime：起止时间
├── Status：Ok / Error / Unset
├── Attributes：键值对标签
├── Events：时间点事件（日志）
└── Links：跨 Trace 关联

上下文传播（W3C Trace Context）
├── HTTP Header：traceparent、tracestate
├── traceparent：version-trace_id-parent_id-flags
│   └── 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
└── gRPC Metadata、Message Queue Headers
```

```python
# OpenTelemetry Python
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor

# 配置
provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="otel-collector:4317"))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer(__name__)

# 手动创建 Span
with tracer.start_as_current_span("process_order") as span:
    span.set_attribute("order.id", "order-123")
    span.set_attribute("order.amount", 99.99)

    # 嵌套 Span
    with tracer.start_as_current_span("validate_payment"):
        validate_payment()

    with tracer.start_as_current_span("update_inventory"):
        update_inventory()

    # 添加事件
    span.add_event("payment_processed", {"payment_method": "credit_card"})

# 自动埋点
FlaskInstrumentor().instrument_app(app)
RequestsInstrumentor().instrument()
```

## 2. 采样策略

```
采样类型

Head-based Sampling（头部采样）
├── 在请求入口处决定是否采样
├── 优点：简单、所有节点一致
├── 缺点：可能错过异常的尾部请求
└── 实现：概率采样（1% / 10% / 100%）

Tail-based Sampling（尾部采样）
├── 请求完成后根据特征决定是否保留
├── 优点：保留异常/慢请求
├── 缺点：需要缓存所有 Span，内存开销大
└── 实现：Collector 端决策

智能采样
├── 基于延迟：慢请求采样
├── 基于错误：错误请求采样
├── 基于用户：VIP 用户全量采样
└── 自适应：根据负载动态调整
```

```yaml
# OpenTelemetry Collector 采样配置
tail_sampling:
  policies:
    - name: errors
      type: status_code
      status_code: {status_codes: [ERROR]}
    - name: slow_requests
      type: latency
      latency: {threshold_ms: 1000}
    - name: probabilistic
      type: probabilistic
      probabilistic: {sampling_percentage: 10}
```

## 3. 追踪与日志/指标关联

```
关联设计

Trace ──▶ Logs
├── TraceID 写入日志
├── SpanID 写入日志
└── 在日志系统中可按 TraceID 查询所有相关日志

Trace ──▶ Metrics
├── 从 Trace 生成 RED 指标
├── Exemplar：在 Metrics 中嵌入 TraceID 示例
└── 从 Histogram 跳转到具体 Trace

查询示例：
1. Grafana 看到 P99 延迟异常
2. 点击 Exemplar，跳转 Jaeger 看具体 Trace
3. Trace 中每个 Span 链接到对应日志
4. 日志中找到错误详情
```

```python
# Exemplar 支持（Python Prometheus）
from prometheus_client import Histogram

request_duration = Histogram(
    'http_request_duration_seconds',
    'Request duration',
    ['method', 'route']
)

# 记录 exemplar
request_duration.labels(method='GET', route='/api/users').observe(
    duration,
    exemplar={'trace_id': trace_id, 'span_id': span_id}
)
```
