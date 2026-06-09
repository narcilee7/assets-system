# OpenTelemetry Trace Baseline

分布式链路追踪是定位跨服务延迟问题的终极武器。OpenTelemetry 提供了 vendor-neutral 的标准。

## 架构

```
[Node.js App] --spans--> [OTLP Collector] --> [Jaeger / Tempo / Datadog]
```

## 实现

### 1. SDK 初始化（应用入口第一时间加载）

```ts
// tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'nodejs-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
  }),
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT })
  ),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // 减少噪声
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().then(() => console.log('Tracing terminated'));
});
```

### 2. 手动创建 Span（业务关键路径）

```ts
// manual-span.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('order-service');

export async function processPayment(orderId: string, amount: number) {
  return tracer.startActiveSpan('processPayment', async (span) => {
    try {
      span.setAttribute('order.id', orderId);
      span.setAttribute('payment.amount', amount);

      const result = await callPaymentGateway(orderId, amount);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err: any) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

### 3. 将 TraceId 注入日志

```ts
// logger-with-trace.ts
import { logger } from '../pino-logger/logger';
import { trace } from '@opentelemetry/api';

export function getTraceAwareLogger() {
  const span = trace.getActiveSpan();
  const context = span?.spanContext();
  return logger.child({
    traceId: context?.traceId,
    spanId: context?.spanId,
  });
}
```

## 关键指标

| 指标 | 说明 |
| --- | --- |
| Span | 单个操作单元 |
| Trace | 同一请求的所有 Span 组成一棵树 |
| Baggage | 跨 Span 传递的上下文数据 |
|Sampler | 控制采样率，避免高流量场景开销过大 |

## 生产 checklist

- [ ] SDK 在应用最顶部 `require` 或 `import`，确保所有库被自动埋点。
- [ ] 关闭 `@opentelemetry/instrumentation-fs`，文件系统埋点噪声极大。
- [ ] 使用 `BatchSpanProcessor`，避免每个 span 都发网络请求。
- [ ] 配置合理的采样率（如 1% 或基于尾采样）。
- [ ] 确保 traceId 穿透到下游 HTTP / gRPC / 消息队列。
