# 性能监控

## 1. Web Vitals

```javascript
// 使用 web-vitals 库
import { getCLS, getFID, getFCP, getLCP, getTTFB, getINP } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify(metric);

  // 使用 sendBeacon 或 fetch
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { body, method: 'POST', keepalive: true });
  }
}

getCLS(sendToAnalytics);  // Cumulative Layout Shift
getFID(sendToAnalytics);  // First Input Delay（将被 INP 替代）
getFCP(sendToAnalytics);  // First Contentful Paint
getLCP(sendToAnalytics);  // Largest Contentful Paint
getTTFB(sendToAnalytics); // Time to First Byte
getINP(sendToAnalytics);  // Interaction to Next Paint（新核心指标）
```

| 指标 | 含义 | 好 | 需改进 | 差 |
|------|------|-----|--------|-----|
| **LCP** | 最大内容绘制 | ≤2.5s | ≤4s | >4s |
| **FID** | 首次输入延迟 | ≤100ms | ≤300ms | >300ms |
| **CLS** | 累积布局偏移 | ≤0.1 | ≤0.25 | >0.25 |
| **INP** | 交互到下一次绘制 | ≤200ms | ≤500ms | >500ms |
| **TTFB** | 首字节时间 | ≤600ms | ≤1.8s | >1.8s |
| **FCP** | 首次内容绘制 | ≤1.8s | ≤3s | >3s |

## 2. 自定义性能指标

```javascript
// 1. SPA 路由切换时间
let routeStartTime;

function onRouteChange() {
  routeStartTime = performance.now();
}

function onRouteComplete() {
  const duration = performance.now() - routeStartTime;
  sendToAnalytics({
    name: 'route-change',
    value: duration,
    path: location.pathname,
  });
}

// 2. 组件渲染时间（React DevTools Profiler API）
function onRenderCallback(id, phase, actualDuration) {
  if (actualDuration > 16) { // 超过一帧
    sendToAnalytics({
      name: 'component-render',
      component: id,
      phase, // 'mount' | 'update'
      duration: actualDuration,
    });
  }
}

// 3. API 请求时间
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const start = performance.now();
  try {
    const response = await originalFetch.apply(this, args);
    const duration = performance.now() - start;

    sendToAnalytics({
      name: 'api-request',
      url: args[0],
      status: response.status,
      duration,
    });

    return response;
  } catch (error) {
    const duration = performance.now() - start;
    sendToAnalytics({
      name: 'api-request-error',
      url: args[0],
      duration,
      error: error.message,
    });
    throw error;
  }
};

// 4. 资源加载时间
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 1000) { // 慢资源
      sendToAnalytics({
        name: 'slow-resource',
        url: entry.name,
        duration: entry.duration,
        initiatorType: entry.initiatorType,
      });
    }
  }
}).observe({ type: 'resource' });
```

## 3. Long Task 监控

```javascript
// 监控长任务（阻塞主线程）
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    sendToAnalytics({
      name: 'long-task',
      duration: entry.duration,
      startTime: entry.startTime,
      attribution: entry.attribution?.map((a) => ({
        type: a.type,
        name: a.name,
      })),
    });
  }
}).observe({ type: 'longtask' });
```

## 4. RUM（Real User Monitoring）数据模型

```javascript
// 页面会话级别的性能快照
function getPageSnapshot() {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');

  return {
    // 导航计时
    dns: nav.domainLookupEnd - nav.domainLookupStart,
    tcp: nav.connectEnd - nav.connectStart,
    ssl: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
    ttfb: nav.responseStart - nav.startTime,
    download: nav.responseEnd - nav.responseStart,
    domParse: nav.domInteractive - nav.responseEnd,
    domReady: nav.domContentLoadedEventEnd - nav.startTime,
    loadComplete: nav.loadEventEnd - nav.startTime,

    // Paint 计时
    fcp: paint.find((p) => p.name === 'first-contentful-paint')?.startTime,

    // 资源数量
    resourceCount: performance.getEntriesByType('resource').length,
    resourceSize: performance.getEntriesByType('resource').reduce((sum, r) => sum + (r.transferSize || 0), 0),

    // 页面信息
    url: location.href,
    referrer: document.referrer,
    timestamp: Date.now(),
  };
}

// 页面卸载时上报
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    const snapshot = getPageSnapshot();
    navigator.sendBeacon('/api/rum', JSON.stringify(snapshot));
  }
});
```
