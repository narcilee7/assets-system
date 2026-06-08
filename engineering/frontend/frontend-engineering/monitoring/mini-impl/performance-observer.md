# 手写性能监控收集器

## 目标

实现一个简化版性能监控收集器，支持：
1. 收集 Web Vitals 指标
2. 收集自定义性能指标
3. 长任务检测
4. 批量上报性能数据

## 实现

```javascript
// performance-observer.js
class PerformanceMonitor {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/vitals';
    this.sampleRate = options.sampleRate || 1.0;
    this.flushInterval = options.flushInterval || 10000;
    this.queue = [];
    this.metrics = {};

    this._observeWebVitals();
    this._observeResources();
    this._observeLongTasks();
    this._observeNavigation();
    this._startFlushTimer();

    // 页面卸载时上报
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this._reportPageSummary();
        this.flush();
      }
    });
  }

  // 收集 Web Vitals
  _observeWebVitals() {
    // LCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this._record('LCP', lastEntry.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // FID
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const delay = entry.processingStart - entry.startTime;
        this._record('FID', delay);
      }
    }).observe({ type: 'first-input', buffered: true });

    // CLS
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });

    // 页面卸载时上报 CLS
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && clsValue > 0) {
        this._record('CLS', clsValue);
        clsValue = 0;
      }
    });

    // FCP
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this._record('FCP', entry.startTime);
        }
      }
    }).observe({ type: 'paint', buffered: true });

    // INP
    let inpValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = entry.processingEnd - entry.startTime;
        if (duration > inpValue) {
          inpValue = duration;
        }
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 0 });

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && inpValue > 0) {
        this._record('INP', inpValue);
        inpValue = 0;
      }
    });
  }

  // 收集资源加载
  _observeResources() {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // 只关注慢资源
        if (entry.duration > 1000) {
          this._record('slow-resource', entry.duration, {
            url: entry.name,
            initiatorType: entry.initiatorType,
            transferSize: entry.transferSize,
          });
        }
      }
    }).observe({ type: 'resource' });
  }

  // 长任务检测
  _observeLongTasks() {
    if (!('PerformanceLongTaskTiming' in window)) return;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this._record('long-task', entry.duration, {
          startTime: entry.startTime,
          attribution: entry.attribution?.map((a) => ({
            type: a.entryType,
            name: a.name,
          })),
        });
      }
    }).observe({ type: 'longtask' });
  }

  // 导航计时
  _observeNavigation() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        if (!nav) return;

        this._record('navigation', nav.loadEventEnd - nav.startTime, {
          ttfb: nav.responseStart - nav.startTime,
          dns: nav.domainLookupEnd - nav.domainLookupStart,
          tcp: nav.connectEnd - nav.connectStart,
          download: nav.responseEnd - nav.responseStart,
          domParse: nav.domInteractive - nav.responseEnd,
          domReady: nav.domContentLoadedEventEnd - nav.startTime,
        });
      }, 0);
    });
  }

  // 记录指标
  _record(name, value, meta = {}) {
    if (Math.random() > this.sampleRate) return;

    this.metrics[name] = {
      value: Math.round(value * 100) / 100,
      ...meta,
      timestamp: Date.now(),
      url: location.href,
    };

    this.queue.push({
      name,
      value: Math.round(value * 100) / 100,
      ...meta,
      timestamp: Date.now(),
      url: location.href,
    });
  }

  // 上报页面摘要
  _reportPageSummary() {
    const snapshot = {
      name: 'page-summary',
      metrics: { ...this.metrics },
      timestamp: Date.now(),
      url: location.href,
    };
    this.queue.push(snapshot);
  }

  // 自定义指标 API
  mark(name, meta = {}) {
    performance.mark(name);
    this._record(`custom-${name}`, performance.now(), meta);
  }

  measure(name, startMark, endMark, meta = {}) {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, 'measure');
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      this._record(`custom-${name}`, lastEntry.duration, meta);
    }
  }

  // 批量上报
  flush() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    const body = JSON.stringify(batch);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.endpoint, body);
    } else {
      fetch(this.endpoint, {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {
        this.queue.unshift(...batch);
      });
    }
  }

  _startFlushTimer() {
    setInterval(() => this.flush(), this.flushInterval);
  }
}

// 使用
const monitor = new PerformanceMonitor({
  endpoint: 'https://monitor.example.com/api/vitals',
  sampleRate: 0.5,
});

// 自定义性能指标
monitor.mark('app-init');
// ... 应用初始化逻辑 ...
monitor.mark('app-ready');
monitor.measure('app-startup', 'app-init', 'app-ready');
```
