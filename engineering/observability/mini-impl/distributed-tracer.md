# 手写分布式追踪器

## 目标

实现一个简化版分布式追踪器，支持：
1. Trace / Span 创建与管理
2. 上下文传播（TraceID / SpanID）
3. 嵌套 Span
4. W3C Trace Context 格式
5. 简单的导出（JSON / Console）

## 实现

```javascript
// distributed-tracer.js

const crypto = require('crypto');

// ========== ID 生成 ==========

function generateTraceId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateSpanId() {
  return crypto.randomBytes(8).toString('hex');
}

// ========== Span ==========

class Span {
  constructor(name, options = {}) {
    this.name = name;
    this.traceId = options.traceId || generateTraceId();
    this.spanId = generateSpanId();
    this.parentSpanId = options.parentSpanId || null;
    this.startTime = Date.now();
    this.endTime = null;
    this.status = 'unset'; // unset / ok / error
    this.attributes = new Map();
    this.events = [];
    this.links = options.links || [];
  }

  setAttribute(key, value) {
    this.attributes.set(key, value);
    return this;
  }

  setAttributes(attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      this.attributes.set(k, v);
    }
    return this;
  }

  addEvent(name, attributes = {}, timestamp = Date.now()) {
    this.events.push({ name, attributes, timestamp });
    return this;
  }

  setStatus(code, message) {
    this.status = code;
    if (message) this.statusMessage = message;
    return this;
  }

  recordException(error) {
    this.setStatus('error', error.message);
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    });
    return this;
  }

  end(endTime = Date.now()) {
    this.endTime = endTime;
  }

  get duration() {
    if (!this.endTime) return Date.now() - this.startTime;
    return this.endTime - this.startTime;
  }

  toJSON() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      status: this.status,
      statusMessage: this.statusMessage,
      attributes: Object.fromEntries(this.attributes),
      events: this.events,
      links: this.links,
    };
  }
}

// ========== Trace Context ==========

class TraceContext {
  constructor(traceId, spanId, flags = '01') {
    this.traceId = traceId;
    this.spanId = spanId;
    this.flags = flags; // 01 = sampled
  }

  // W3C traceparent 格式：00-traceId-parentId-flags
  static fromTraceparent(header) {
    const parts = header.split('-');
    if (parts.length !== 4) return null;
    return new TraceContext(parts[1], parts[2], parts[3]);
  }

  toTraceparent() {
    return `00-${this.traceId}-${this.spanId}-${this.flags}`;
  }

  isSampled() {
    return (parseInt(this.flags, 16) & 1) === 1;
  }
}

// ========== Tracer ==========

class Tracer {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.exporter = options.exporter || new ConsoleExporter();
    this.sampler = options.sampler || new ProbabilitySampler(1.0);
    this.activeSpans = new Map(); // asyncId -> Span
  }

  startSpan(name, options = {}) {
    const parentContext = options.parent || this.currentContext();

    let traceId, parentSpanId;
    if (parentContext) {
      traceId = parentContext.traceId;
      parentSpanId = parentContext.spanId;
    }

    const span = new Span(name, {
      traceId,
      parentSpanId,
      links: options.links,
    });

    // 采样决策
    if (options.sampled !== undefined) {
      span.sampled = options.sampled;
    } else {
      span.sampled = this.sampler.shouldSample(span);
    }

    // 设置默认属性
    span.setAttribute('service.name', this.serviceName);
    if (options.attributes) {
      span.setAttributes(options.attributes);
    }

    // 设为当前 Span
    this._setCurrentSpan(span);

    return span;
  }

  startActiveSpan(name, fn, options = {}) {
    const span = this.startSpan(name, options);
    try {
      const result = fn(span);
      if (result && typeof result.then === 'function') {
        return result.finally(() => this.endSpan(span));
      }
      this.endSpan(span);
      return result;
    } catch (error) {
      span.recordException(error);
      this.endSpan(span);
      throw error;
    }
  }

  endSpan(span) {
    if (span.endTime) return; // 已结束
    span.end();

    if (span.sampled) {
      this.exporter.export([span]);
    }

    this._clearCurrentSpan(span);
  }

  // 从 HTTP Header 提取上下文
  extractFromHeaders(headers) {
    const traceparent = headers['traceparent'];
    if (traceparent) {
      const ctx = TraceContext.fromTraceparent(traceparent);
      if (ctx) {
        return { traceId: ctx.traceId, spanId: ctx.spanId };
      }
    }
    return null;
  }

  // 注入上下文到 HTTP Header
  injectIntoHeaders(span, headers = {}) {
    headers['traceparent'] = new TraceContext(span.traceId, span.spanId).toTraceparent();
    return headers;
  }

  currentContext() {
    // 简化版：使用异步上下文追踪
    // 实际应使用 AsyncLocalStorage
    return this._currentContext;
  }

  _setCurrentSpan(span) {
    this._currentContext = { traceId: span.traceId, spanId: span.spanId };
  }

  _clearCurrentSpan(span) {
    if (this._currentContext && this._currentContext.spanId === span.spanId) {
      this._currentContext = span.parentSpanId
        ? { traceId: span.traceId, spanId: span.parentSpanId }
        : null;
    }
  }
}

// ========== Sampler ==========

class ProbabilitySampler {
  constructor(rate) {
    this.rate = rate;
  }

  shouldSample(span) {
    return Math.random() < this.rate;
  }
}

class AlwaysSampler {
  shouldSample() {
    return true;
  }
}

class NeverSampler {
  shouldSample() {
    return false;
  }
}

// ========== Exporter ==========

class ConsoleExporter {
  export(spans) {
    for (const span of spans) {
      console.log('[TRACE]', JSON.stringify(span.toJSON()));
    }
  }
}

class InMemoryExporter {
  constructor() {
    this.spans = [];
  }

  export(spans) {
    this.spans.push(...spans);
  }

  getFinishedSpans() {
    return this.spans;
  }

  reset() {
    this.spans = [];
  }
}

class BatchExporter {
  constructor(delegate, options = {}) {
    this.delegate = delegate;
    this.batchSize = options.batchSize || 100;
    this.flushInterval = options.flushInterval || 5000;
    this.buffer = [];
    this._startTimer();
  }

  export(spans) {
    this.buffer.push(...spans);
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.batchSize);
    this.delegate.export(batch);
  }

  _startTimer() {
    setInterval(() => this.flush(), this.flushInterval);
  }
}

// ========== 使用 ==========

const tracer = new Tracer('payment-service', {
  sampler: new ProbabilitySampler(1.0),
});

// 简单 Span
const span = tracer.startSpan('process_payment', {
  attributes: { 'payment.method': 'credit_card' },
});
span.addEvent('validation_start');
// ... 业务逻辑
span.addEvent('validation_complete', { duration_ms: 45 });
span.setAttribute('payment.amount', 99.99);
tracer.endSpan(span);

// 嵌套 Span
tracer.startActiveSpan('handle_order', (rootSpan) => {
  rootSpan.setAttribute('order.id', 'order-123');

  tracer.startActiveSpan('validate_order', (validateSpan) => {
    validateSpan.setAttribute('validation.result', 'ok');
    // validateSpan 自动结束
  });

  tracer.startActiveSpan('charge_payment', (chargeSpan) => {
    try {
      // ... 支付逻辑
      chargeSpan.setAttribute('charge.status', 'success');
    } catch (error) {
      chargeSpan.recordException(error);
      throw error;
    }
    // chargeSpan 自动结束
  });

  // rootSpan 自动结束
});

// 跨服务传播
const incomingHeaders = { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' };
const parentContext = tracer.extractFromHeaders(incomingHeaders);
const newSpan = tracer.startSpan('process_request', { parent: parentContext });

const outgoingHeaders = tracer.injectIntoHeaders(newSpan, {});
// outgoingHeaders.traceparent = '00-4bf92f...-newSpanId-01'

module.exports = {
  Tracer,
  Span,
  TraceContext,
  ConsoleExporter,
  InMemoryExporter,
  BatchExporter,
  ProbabilitySampler,
};
```
