# API 监控

## 1. Fetch/XHR 拦截

```javascript
// ============ 拦截 XMLHttpRequest ============
function interceptXHR() {
  const OriginalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function () {
    const xhr = new OriginalXHR();
    const startTime = performance.now();
    let method = 'GET';
    let url = '';

    const originalOpen = xhr.open;
    xhr.open = function (m, u) {
      method = m;
      url = u;
      return originalOpen.apply(this, arguments);
    };

    const originalSend = xhr.send;
    xhr.send = function (body) {
      const onLoad = () => {
        const duration = performance.now() - startTime;
        report({
          type: 'api',
          method,
          url,
          status: xhr.status,
          duration: Math.round(duration),
          requestSize: body?.length || 0,
          responseSize: xhr.responseText?.length || 0,
        });
      };

      xhr.addEventListener('load', onLoad);
      xhr.addEventListener('error', () => {
        report({ type: 'api', method, url, status: 0, error: 'network_error' });
      });
      xhr.addEventListener('timeout', () => {
        report({ type: 'api', method, url, status: 0, error: 'timeout' });
      });

      return originalSend.apply(this, arguments);
    };

    return xhr;
  };
}

// ============ 拦截 Fetch ============
function interceptFetch() {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    const startTime = performance.now();
    const url = typeof input === 'string' ? input : input.url;
    const method = init.method || 'GET';

    try {
      const response = await originalFetch.apply(this, arguments);
      const duration = performance.now() - startTime;

      report({
        type: 'api',
        method,
        url,
        status: response.status,
        duration: Math.round(duration),
      });

      return response;
    } catch (error) {
      report({
        type: 'api',
        method,
        url,
        status: 0,
        error: error.message,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  };
}
```

## 2. Trace ID 传播

```javascript
// 从服务端接收 Trace ID，并在所有请求中传播
const TRACE_ID_HEADER = 'x-trace-id';

function getTraceId() {
  // 1. 从服务端注入的 meta 标签读取
  const meta = document.querySelector('meta[name="trace-id"]');
  if (meta) return meta.content;

  // 2. 从 URL 参数读取（调试用）
  return new URLSearchParams(location.search).get('trace_id');
}

function withTraceId(init = {}) {
  const traceId = getTraceId() || generateTraceId();
  return {
    ...init,
    headers: {
      ...init.headers,
      [TRACE_ID_HEADER]: traceId,
    },
  };
}

// 使用
fetch('/api/data', withTraceId());
```

## 3. 慢请求与失败率

```javascript
// 聚合 API 指标
class APIMetrics {
  constructor() {
    this.calls = [];  // { url, status, duration, timestamp }
  }

  record(call) {
    this.calls.push({ ...call, timestamp: Date.now() });
    // 只保留最近 1000 条
    if (this.calls.length > 1000) this.calls.shift();
  }

  getStats(timeWindow = 5 * 60 * 1000) {
    const cutoff = Date.now() - timeWindow;
    const recent = this.calls.filter((c) => c.timestamp > cutoff);

    const byEndpoint = groupBy(recent, (c) => {
      // 规范化 URL：去掉 ID 参数
      return c.url.replace(/\/\d+/g, '/:id');
    });

    return Object.entries(byEndpoint).map(([endpoint, calls]) => ({
      endpoint,
      count: calls.length,
      avgDuration: average(calls.map((c) => c.duration)),
      p95Duration: percentile(calls.map((c) => c.duration), 0.95),
      errorRate: calls.filter((c) => c.status >= 400 || c.status === 0).length / calls.length,
      slowRate: calls.filter((c) => c.duration > 1000).length / calls.length,
    }));
  }
}
```
