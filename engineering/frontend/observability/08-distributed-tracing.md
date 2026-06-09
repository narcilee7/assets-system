# 分布式链路追踪

## 1. Trace 模型

```
┌─────────────────────────────────────────────────────────────┐
│                         Trace                                │
│  trace_id: abc123                                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Span 1     │  │   Span 2     │  │   Span 3     │      │
│  │  (Browser)   │  │  (Gateway)   │  │  (Service A) │      │
│  │              │  │              │  │              │      │
│  │  start: 0ms  │  │  start: 15ms │  │  start: 45ms │      │
│  │  end: 120ms  │  │  end: 100ms  │  │  end: 90ms   │      │
│  │              │  │              │  │              │      │
│  │  parent: null│  │  parent: 1   │  │  parent: 2   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 2. W3C Trace Context

```
HTTP Header 格式：
  traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
  │  │         │  │                                    │              │
  │  │         │  └─ trace_id (16 bytes hex)          └─ parent_id   └─ flags
  │  │         └─ version (00)
  │  └─ traceparent (header name)
  └─ 00 = sampled

  tracestate: vendor1=value1,vendor2=value2
```

## 3. 前端 Trace 实现

```javascript
// OpenTelemetry Web 简化版

function generateTraceId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSpanId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

class Tracer {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.spans = [];
  }

  startSpan(name, options = {}) {
    const span = {
      traceId: options.traceId || generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: options.parentSpanId,
      name,
      serviceName: this.serviceName,
      startTime: performance.now(),
      attributes: options.attributes || {},
      status: 'ok',
    };

    this.spans.push(span);
    return span;
  }

  endSpan(span, options = {}) {
    span.endTime = performance.now();
    span.duration = span.endTime - span.startTime;
    if (options.status) span.status = options.status;
    if (options.error) span.error = options.error;
  }

  // 将 traceparent header 附加到请求
  injectHeaders(span) {
    return {
      traceparent: `00-${span.traceId}-${span.spanId}-01`,
    };
  }

  // 从响应中提取 trace 信息
  extractHeaders(headers) {
    const traceparent = headers.get('traceparent');
    if (!traceparent) return null;

    const [, version, traceId, parentId, flags] = traceparent.split('-');
    return { traceId, parentId, flags };
  }
}

// ============ 使用 ============

const tracer = new Tracer('frontend-app');

async function loadDashboard() {
  const span = tracer.startSpan('load_dashboard', {
    attributes: { route: '/dashboard', userId: 'abc123' },
  });

  try {
    const response = await fetch('/api/dashboard', {
      headers: tracer.injectHeaders(span),
    });

    tracer.endSpan(span);
  } catch (error) {
    tracer.endSpan(span, { status: 'error', error: error.message });
  }
}
```

## 4. 自动 Instrumentation

```javascript
// 自动为所有 fetch 请求创建 span
function instrumentFetch(tracer) {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const span = tracer.startSpan(`HTTP ${init.method || 'GET'}`, {
      attributes: { 'http.url': url },
    });

    try {
      const response = await originalFetch(input, {
        ...init,
        headers: {
          ...init.headers,
          ...tracer.injectHeaders(span),
        },
      });

      span.attributes['http.status_code'] = response.status;
      tracer.endSpan(span);
      return response;
    } catch (error) {
      tracer.endSpan(span, { status: 'error', error: error.message });
      throw error;
    }
  };
}
```
