# 可观测性基础

## 1. 三大支柱

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Metrics   │  │    Logs     │  │   Traces    │
├─────────────┤  ├─────────────┤  ├─────────────┤
│ 数值化指标   │  │ 结构化文本   │  │ 请求链路     │
│ 看趋势      │  │ 查细节      │  │ 跟因果      │
├─────────────┤  ├─────────────┤  ├─────────────┤
│ LCP: 2.1s   │  │ ERROR:      │  │ trace_id    │
│ Error: 0.5% │  │ user login  │  │ ├─ span1    │
│ QPS: 10k    │  │ failed:     │  │ │  ├─ span2 │
│             │  │ timeout     │  │ │  └─ span3 │
└─────────────┘  └─────────────┘  └─────────────┘
```

## 2. 前端黄金信号

| 信号 | 说明 | 采集方式 |
|------|------|----------|
| **Latency** | 页面加载/交互延迟 | Performance API, Web Vitals |
| **Traffic** | PV/UV、路由访问量 | 路由拦截、埋点 |
| **Errors** | JS 异常、API 失败 | window.onerror, fetch 拦截 |
| **Saturation** | 长任务、主线程阻塞 | Long Tasks API |

## 3. 监控金字塔

```
         ┌─────────────┐
         │  业务指标    │   转化率、留存、GMV
         │  （北极星）  │
         ├─────────────┤
         │  用户体验    │   Web Vitals、交互延迟
         ├─────────────┤
         │  应用性能    │   资源加载、API 延迟
         ├─────────────┤
         │  基础设施    │   CDN、DNS、TLS
         ├─────────────┤
         │  错误异常    │   JS Error、API 5xx
         └─────────────┘
```

## 4. 信号分类

### Error 信号
```javascript
{
  type: 'js_error',           // js_error | promise_rejection | resource_error | api_error
  message: 'Cannot read property of undefined',
  stack: 'at foo (app.js:123:45)\nat bar (app.js:67:8)',
  filename: 'https://cdn.example.com/app.js',
  lineno: 123,
  colno: 45,
  userAgent: 'Mozilla/5.0...',
  url: 'https://example.com/dashboard',
  release: '1.2.3',
  userId: 'user_abc123',
  traceId: 'trace_xyz789',
}
```

### Performance 信号
```javascript
{
  type: 'web_vital',
  name: 'LCP',                // LCP | FID | CLS | INP | TTFB | FCP
  value: 2.1,
  rating: 'needs-improvement', // good | needs-improvement | poor
  entryType: 'largest-contentful-paint',
  url: 'https://example.com/page',
  device: 'mobile',
  connection: '4g',
}
```

### API 信号
```javascript
{
  type: 'api',
  method: 'POST',
  url: '/api/v1/orders',
  status: 200,
  duration: 245,
  requestSize: 1024,
  responseSize: 4096,
  traceId: 'trace_xyz789',
  error: null,
}
```

### Behavior 信号
```javascript
{
  type: 'click',
  target: 'button[data-testid="checkout-btn"]',
  text: '立即购买',
  x: 120,
  y: 340,
  timestamp: 1710000000000,
  sessionId: 'session_def456',
  url: 'https://example.com/cart',
}
```
