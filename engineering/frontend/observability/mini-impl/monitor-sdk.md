# 手写前端监控 SDK

## 1. 架构设计

```
MonitorSDK
  ├── Collector（采集器）
  │     ├── ErrorCollector      错误采集
  │     ├── PerformanceCollector 性能采集
  │     ├── APICollector        API 采集
  │     └── BehaviorCollector   行为采集
  ├── Reporter（上报器）
  │     ├── BatchQueue          批量队列
  │     ├── RetryQueue          重试队列
  │     └── SendBeacon          优先使用 sendBeacon
  └── Config（配置）
        ├── sampleRate          采样率
        ├── bufferSize          缓冲大小
        └── endpoint            上报地址
```

## 2. 核心实现

```javascript
// mini-monitor-sdk.js

class MonitorSDK {
  constructor(options = {}) {
    this.config = {
      endpoint: options.endpoint || '/api/monitor',
      sampleRate: options.sampleRate ?? 1.0,
      bufferSize: options.bufferSize ?? 20,
      flushInterval: options.flushInterval ?? 5000,
      appId: options.appId,
      release: options.release,
      env: options.env,
    };

    this.queue = [];
    this.sessionId = this.generateId();
    this.userId = options.userId;

    this.initCollectors();
    this.startFlushTimer();
  }

  generateId() {
    return Math.random().toString(36).substring(2, 15);
  }

  // ============ 采集器初始化 ============
  initCollectors() {
    this.collectError();
    this.collectPerformance();
    this.collectAPI();
    this.collectBehavior();
  }

  // ============ 错误采集 ============
  collectError() {
    window.addEventListener('error', (event) => {
      this.report({
        type: 'error',
        subType: 'js_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    }, true);

    window.addEventListener('unhandledrejection', (event) => {
      this.report({
        type: 'error',
        subType: 'promise_rejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
      });
    });
  }

  // ============ 性能采集 ============
  collectPerformance() {
    // Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.report({
          type: 'performance',
          subType: entry.entryType,
          name: entry.name,
          value: entry.startTime,
          duration: entry.duration,
        });
      }
    });

    observer.observe({ entryTypes: ['largest-contentful-paint', 'layout-shift', 'longtask'] });

    // Navigation Timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
          this.report({
            type: 'performance',
            subType: 'navigation',
            dns: nav.domainLookupEnd - nav.domainLookupStart,
            tcp: nav.connectEnd - nav.connectStart,
            ttfb: nav.responseStart - nav.startTime,
            domReady: nav.domContentLoadedEventEnd - nav.startTime,
            loadComplete: nav.loadEventEnd - nav.startTime,
          });
        }
      }, 0);
    });
  }

  // ============ API 采集 ============
  collectAPI() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const start = performance.now();
      try {
        const response = await originalFetch(...args);
        this.report({
          type: 'api',
          url: args[0],
          method: args[1]?.method || 'GET',
          status: response.status,
          duration: Math.round(performance.now() - start),
        });
        return response;
      } catch (error) {
        this.report({
          type: 'api',
          url: args[0],
          method: args[1]?.method || 'GET',
          status: 0,
          duration: Math.round(performance.now() - start),
          error: error.message,
        });
        throw error;
      }
    };
  }

  // ============ 行为采集 ============
  collectBehavior() {
    document.addEventListener('click', (e) => {
      this.report({
        type: 'behavior',
        subType: 'click',
        target: e.target.tagName,
        id: e.target.id,
        className: e.target.className,
        text: e.target.innerText?.slice(0, 50),
        x: e.clientX,
        y: e.clientY,
      });
    });
  }

  // ============ 上报逻辑 ============
  report(data) {
    // 采样
    if (Math.random() > this.config.sampleRate) return;

    const enriched = {
      ...data,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      appId: this.config.appId,
      release: this.config.release,
      env: this.config.env,
      url: location.href,
      userAgent: navigator.userAgent,
    };

    this.queue.push(enriched);

    if (this.queue.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  // ============ 批量上报 ============
  flush() {
    if (this.queue.length === 0) return;

    const data = [...this.queue];
    this.queue = [];

    const body = JSON.stringify(data);

    // 优先使用 sendBeacon（页面关闭时也能发送）
    if (navigator.sendBeacon) {
      const success = navigator.sendBeacon(this.config.endpoint, new Blob([body], { type: 'application/json' }));
      if (success) return;
    }

    // 降级到 fetch
    fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // 发送失败，存回队列（限制大小防止内存泄漏）
      if (this.queue.length < 100) {
        this.queue.unshift(...data);
      }
    });
  }

  startFlushTimer() {
    setInterval(() => this.flush(), this.config.flushInterval);
  }

  // 页面关闭前强制上报
  destroy() {
    window.addEventListener('beforeunload', () => this.flush());
    window.addEventListener('pagehide', () => this.flush());
  }
}

// ============ 使用 ============
const monitor = new MonitorSDK({
  endpoint: 'https://monitor.example.com/collect',
  appId: 'my-app',
  release: '1.2.3',
  env: 'production',
  sampleRate: 0.5,  // 50% 采样
});

monitor.destroy();
```
