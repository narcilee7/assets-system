# 性能监控

## 1. Web Vitals

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Vitals                            │
├──────────┬──────────────────────────────────────────────────┤
│ LCP      │ Largest Contentful Paint                         │
│          │ 最大内容渲染时间（图片/文本块）                    │
│          │ Good: <2.5s  Needs Improvement: <4s  Poor: >4s   │
├──────────┼──────────────────────────────────────────────────┤
│ INP      │ Interaction to Next Paint                        │
│          │ 交互到下一次绘制（取代 FID）                       │
│          │ Good: <200ms  Needs: <500ms  Poor: >500ms        │
├──────────┼──────────────────────────────────────────────────┤
│ CLS      │ Cumulative Layout Shift                          │
│          │ 累积布局偏移（页面跳动）                           │
│          │ Good: <0.1  Needs: <0.25  Poor: >0.25            │
├──────────┼──────────────────────────────────────────────────┤
│ TTFB     │ Time to First Byte                               │
│          │ 首字节时间（服务器响应速度）                       │
│          │ Good: <800ms                                     │
├──────────┼──────────────────────────────────────────────────┤
│ FCP      │ First Contentful Paint                           │
│          │ 首个内容绘制时间                                   │
│          │ Good: <1.8s                                      │
└──────────┴──────────────────────────────────────────────────┘
```

## 2. 采集 Web Vitals

```javascript
import { onLCP, onINP, onCLS, onTTFB, onFCP } from 'web-vitals';

// 基础采集
onLCP(console.log);
onINP(console.log);
onCLS(console.log);

// 上报到监控系统
function reportWebVital(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,  // good | needs-improvement | poor
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: location.href,
    device: getDeviceType(),
  });

  // 使用 sendBeacon 确保可靠上报
  navigator.sendBeacon('/analytics/web-vitals', body);
}

onLCP(reportWebVital);
onINP(reportWebVital, { reportAllChanges: true });  // 报告所有变化
onCLS(reportWebVital);
onTTFB(reportWebVital);
```

## 3. Performance API

```javascript
// ============ Navigation Timing ============
const nav = performance.getEntriesByType('navigation')[0];

const metrics = {
  dns: nav.domainLookupEnd - nav.domainLookupStart,
  tcp: nav.connectEnd - nav.connectStart,
  ssl: nav.secureConnectionStart > 0
    ? nav.connectEnd - nav.secureConnectionStart
    : 0,
  ttfb: nav.responseStart - nav.startTime,
  domParse: nav.domInteractive - nav.responseEnd,
  domReady: nav.domContentLoadedEventEnd - nav.startTime,
  loadComplete: nav.loadEventEnd - nav.startTime,
};

// ============ Long Tasks ============
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    report({
      type: 'long_task',
      duration: entry.duration,
      startTime: entry.startTime,
      // 主线程阻塞 entry.duration 毫秒
    });
  }
});
observer.observe({ entryTypes: ['longtask'] });

// ============ Resource Timing ============
const resourceObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    report({
      type: 'resource',
      name: entry.name,
      initiatorType: entry.initiatorType,  // script | css | img | fetch | xmlhttprequest
      duration: entry.duration,
      transferSize: entry.transferSize,    // 实际传输大小（压缩后）
      decodedBodySize: entry.decodedBodySize,  // 解压后大小
      cache: entry.transferSize === 0 ? 'hit' : 'miss',
    });
  }
});
resourceObserver.observe({ entryTypes: ['resource'] });

// ============ Paint Timing ============
const paintObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.startTime}ms`);
    // first-paint, first-contentful-paint
  }
});
paintObserver.observe({ entryTypes: ['paint'] });

// ============ Element Timing ============
// HTML: <img elementtiming="hero-image" src="...">
const elementObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.identifier}: ${entry.renderTime}ms`);
  }
});
elementObserver.observe({ entryTypes: ['element'] });
```

## 4. 自定义性能标记

```javascript
// 业务自定义指标
performance.mark('checkout-start');
// ... 结账流程 ...
performance.mark('checkout-end');
performance.measure('checkout-duration', 'checkout-start', 'checkout-end');

const measure = performance.getEntriesByName('checkout-duration')[0];
report({ type: 'custom_metric', name: 'checkout', value: measure.duration });
```
