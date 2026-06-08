# Python OpenTelemetry

OpenTelemetry 是云原生可观测性的标准，Python SDK 支持 trace、metrics、logs。

## 核心实现

```python
# telemetry.py
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

def setup_telemetry(service_name: str):
    # Trace
    trace_provider = TracerProvider()
    trace.set_tracer_provider(trace_provider)
    
    otlp_exporter = OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True)
    trace_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    
    # Metrics
    metric_reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint="http://localhost:4317", insecure=True)
    )
    metrics.set_meter_provider(MeterProvider(metric_readers=[metric_reader]))

# FastAPI 自动埋点
from fastapi import FastAPI

app = FastAPI()
FastAPIInstrumentor.instrument_app(app)

# 手动创建 Span
tracer = trace.get_tracer(__name__)

async def process_order(order_id: str):
    with tracer.start_as_current_span("process_order") as span:
        span.set_attribute("order.id", order_id)
        span.set_attribute("order.type", "standard")
        
        # 嵌套 span
        with tracer.start_as_current_span("validate_payment"):
            await validate_payment(order_id)
        
        with tracer.start_as_current_span("update_inventory"):
            await update_inventory(order_id)
        
        span.set_status(trace.Status(trace.StatusCode.OK))
```

## 自定义指标

```python
meter = metrics.get_meter(__name__)

request_counter = meter.create_counter(
    "http_requests_total",
    description="Total HTTP requests",
)

request_histogram = meter.create_histogram(
    "http_request_duration_seconds",
    description="HTTP request duration",
)

# 使用
request_counter.add(1, {"method": "GET", "route": "/users"})
request_histogram.record(0.15, {"method": "GET"})
```
