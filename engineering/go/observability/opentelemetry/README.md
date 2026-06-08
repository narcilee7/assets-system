# Go OpenTelemetry 可观测性

OpenTelemetry (OTel) 是 CNCF 孵化的可观测性标准，提供统一的 API 和 SDK 用于生成、收集和导出 Trace（链路）、Metrics（指标）和 Logs（日志）。Go 的 OTel SDK 设计遵循语言的简洁哲学，通过 `context.Context` 传播 Span 上下文，与 Go 的并发模型无缝集成。

## 核心概念

Trace 描述请求在分布式系统中的完整路径，由多个 Span 组成树状结构。每个 Span 包含操作名、起止时间、标签（Attributes）和事件（Events）。Go 中通过 `otel.Tracer()` 创建 Span，通过 `context.WithValue` 隐式传递 Trace 上下文。

Metrics 包含 Counter（累加）、UpDownCounter（可增减）、Histogram（分布）和 ObservableGauge（观测值）。Go 的 OTel Metrics SDK 支持 Push（主动上报）和 Pull（被采集）两种模式。

OTel 的架构分为：API（ instrumentation 代码调用）、SDK（实现逻辑）、Collector（接收/处理/导出）和 Backend（Jaeger/Tempo/Prometheus/Grafana）。这种分层设计使得业务代码只依赖轻量 API，具体导出逻辑由运维配置。

## 代码实现

```go
// tracer.go
package telemetry

import (
	"context"
	"log"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.20.0"
	"go.opentelemetry.io/otel/trace"
)

var tracer trace.Tracer

// InitTrace 初始化 Tracer
func InitTrace(serviceName, serviceVersion string) (*sdktrace.TracerProvider, error) {
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(
		jaeger.WithEndpoint("http://localhost:14268/api/traces"),
	))
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp,
			sdktrace.WithBatchTimeout(1*time.Second),
			sdktrace.WithExportTimeout(10*time.Second),
		),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(serviceVersion),
			attribute.String("deployment.environment", "production"),
		)),
		sdktrace.WithSampler(sdktrace.TraceIDRatioBased(0.1)), // 10% 采样
	)

	otel.SetTracerProvider(tp)
	tracer = tp.Tracer(serviceName)
	return tp, nil
}

// InitMetrics 初始化 Metrics
func InitMetrics(serviceName string) (*metric.MeterProvider, error) {
	exporter, err := prometheus.New()
	if err != nil {
		return nil, err
	}

	provider := metric.NewMeterProvider(
		metric.WithReader(exporter),
		metric.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
		)),
	)

	otel.SetMeterProvider(provider)
	return provider, nil
}

// Tracer 返回全局 Tracer
func Tracer() trace.Tracer {
	if tracer == nil {
		return otel.Tracer("default")
	}
	return tracer
}

// SpanFromContext 从 context 提取当前 span
func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}
```

```go
// middleware.go
package middleware

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"myapp/telemetry"
)

func OtelTrace() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, span := telemetry.Tracer().Start(c.Request.Context(), c.Request.Method+" "+c.FullPath(),
			trace.WithAttributes(
				attribute.String("http.method", c.Request.Method),
				attribute.String("http.url", c.Request.URL.String()),
				attribute.String("http.client_ip", c.ClientIP()),
				attribute.String("http.user_agent", c.Request.UserAgent()),
			),
		)
		defer span.End()

		// 将 trace context 注入 response header
		c.Header("X-Trace-ID", span.SpanContext().TraceID().String())
		c.Set("trace_ctx", ctx)

		c.Next()

		span.SetAttributes(attribute.Int("http.status_code", c.Writer.Status()))
		span.SetAttributes(attribute.Int("http.response_size", c.Writer.Size()))

		if len(c.Errors) > 0 {
			span.RecordError(c.Errors.Last())
			span.SetStatus(codes.Error, c.Errors.Last().Error())
		} else if c.Writer.Status() >= 500 {
			span.SetStatus(codes.Error, "server error")
		}
	}
}
```

```go
// metrics.go
package telemetry

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

var (
	httpRequestCounter  metric.Int64Counter
	httpRequestDuration metric.Float64Histogram
	dbQueryCounter      metric.Int64Counter
)

func InitCustomMetrics(meter metric.Meter) error {
	var err error

	httpRequestCounter, err = meter.Int64Counter("http_requests_total",
		metric.WithDescription("Total HTTP requests"),
	)
	if err != nil {
		return err
	}

	httpRequestDuration, err = meter.Float64Histogram("http_request_duration_seconds",
		metric.WithDescription("HTTP request duration"),
		metric.WithUnit("s"),
	)
	if err != nil {
		return err
	}

	dbQueryCounter, err = meter.Int64Counter("db_queries_total",
		metric.WithDescription("Total database queries"),
	)
	if err != nil {
		return err
	}

	return nil
}

// RecordHTTPRequest 记录 HTTP 请求指标
func RecordHTTPRequest(ctx context.Context, method, path string, status int, duration time.Duration) {
	attrs := []attribute.KeyValue{
		attribute.String("method", method),
		attribute.String("path", path),
		attribute.Int("status", status),
	}
	httpRequestCounter.Add(ctx, 1, metric.WithAttributes(attrs...))
	httpRequestDuration.Record(ctx, duration.Seconds(), metric.WithAttributes(attrs...))
}

// RecordDBQuery 记录数据库查询
func RecordDBQuery(ctx context.Context, table, operation string) {
	dbQueryCounter.Add(ctx, 1,
		metric.WithAttributes(
			attribute.String("table", table),
			attribute.String("operation", operation),
		),
	)
}
```

```go
// database.go
package db

import (
	"context"
	"database/sql"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// TracedDB 包装 sql.DB，自动记录 trace 和 metrics
func QueryWithTrace(ctx context.Context, db *sql.DB, query string, args ...interface{}) (*sql.Rows, error) {
	tracer := otel.Tracer("database")
	ctx, span := tracer.Start(ctx, "sql.query",
		trace.WithAttributes(
			attribute.String("db.system", "postgresql"),
			attribute.String("db.statement", query),
		),
	)
	defer span.End()

	start := time.Now()
	rows, err := db.QueryContext(ctx, query, args...)
	duration := time.Since(start)

	if err != nil {
		span.RecordError(err)
	}

	telemetry.RecordDBQuery(ctx, "users", "select")
	// 也可以记录慢查询告警
	if duration > 500*time.Millisecond {
		span.AddEvent("slow_query", trace.WithAttributes(
			attribute.Int64("duration_ms", duration.Milliseconds()),
		))
	}

	return rows, err
}
```

## 选型对比

| 方案 | Trace | Metrics | Logs | 生态 | 推荐 |
| --- | --- | --- | --- | --- | --- |
| OpenTelemetry | ✅ | ✅ | ✅ | CNCF 标准 | **新项目首选** |
| OpenTracing + OpenCensus | ✅（仅Trace） | ✅（仅Metrics） | ❌ | 已合并为 OTel | 迁移至 OTel |
| Jaeger Client | ✅ | ❌ | ❌ | 成熟 | 逐步废弃 |
| Prometheus Client | ❌ | ✅ | ❌ | 成熟 | 可被 OTel 替代 |
| Zap + OTel Bridge | ✅ | ✅ | ✅ | 实验性 | 统一方案 |

## 最佳实践

- **Context 传播**：所有函数接收 `context.Context`，通过 `trace.SpanFromContext` 创建子 Span
- **采样策略**：开发环境 100% 采样，生产环境使用概率采样（1-10%）或尾部采样
- **Span 粒度**：一个 HTTP 请求对应一个 Span，内部每个 RPC/DB/Cache 调用对应一个子 Span
- **错误记录**：使用 `span.RecordError(err)` 和 `span.SetStatus(codes.Error, msg)` 标记错误
- ** baggage 限制**：避免在 baggage 中传递大对象，只传递 trace_id、user_id 等轻量标识
- **Collector 部署**：生产环境使用 OTel Collector 做聚合、过滤和路由，减轻应用负担
