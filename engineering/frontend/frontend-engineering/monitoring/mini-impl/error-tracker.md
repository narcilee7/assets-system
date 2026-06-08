# 手写前端错误追踪 SDK

## 目标

实现一个简化版前端错误追踪 SDK，支持：
1. 捕获 JS 错误、Promise 异常、资源加载失败
2. Source Map 友好的堆栈信息
3. 错误去重和采样
4. 批量上报

## 实现

```javascript
// error-tracker.js
class ErrorTracker {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/error';
    this.appKey = options.appKey || 'default';
    this.sampleRate = options.sampleRate || 1.0;
    this.dedupWindow = options.dedupWindow || 60000;
    this.maxQueueSize = options.maxQueueSize || 50;
    this.flushInterval = options.flushInterval || 5000;

    this.queue = [];
    this.seenErrors = new Map();  // 去重记录
    this.sessionId = this._generateId();
    this.userId = options.userId || 'anonymous';

    this._setupListeners();
    this._startFlushTimer();
  }

  // 设置全局监听器
  _setupListeners() {
    // JS 错误
    window.onerror = (message, source, lineno, colno, error) => {
      this.capture({
        type: 'js_error',
        message,
        source,
        lineno,
        colno,
        stack: error?.stack,
      });
      return false;
    };

    // Promise 异常
    window.addEventListener('unhandledrejection', (event) => {
      this.capture({
        type: 'unhandledrejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
      });
    });

    // 资源错误
    window.addEventListener('error', (event) => {
      const target = event.target;
      if (target && (target.src || target.href)) {
        this.capture({
          type: 'resource_error',
          url: target.src || target.href,
          tagName: target.tagName,
        });
      }
    }, true);

    // 页面卸载时 flush
    window.addEventListener('beforeunload', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  // 捕获单个错误
  capture(errorInfo) {
    // 采样
    if (Math.random() > this.sampleRate) return;

    // 去重
    const fingerprint = this._getFingerprint(errorInfo);
    const lastSeen = this.seenErrors.get(fingerprint);
    if (lastSeen && Date.now() - lastSeen < this.dedupWindow) {
      return;
    }
    this.seenErrors.set(fingerprint, Date.now());

    const payload = this._buildPayload(errorInfo);
    this.queue.push(payload);

    // 队列满时立即 flush
    if (this.queue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  // 构建上报数据
  _buildPayload(errorInfo) {
    return {
      // 错误信息
      type: errorInfo.type,
      message: errorInfo.message,
      stack: errorInfo.stack,
      source: errorInfo.source,
      lineno: errorInfo.lineno,
      colno: errorInfo.colno,

      // 上下文
      url: location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      appKey: this.appKey,

      // 性能上下文
      performance: this._getPerformanceContext(),

      // 面包屑（简化版）
      breadcrumbs: this._getBreadcrumbs(),
    };
  }

  _getFingerprint(errorInfo) {
    const stack = errorInfo.stack?.split('\n').slice(0, 3).join('') || '';
    return this._hash(`${errorInfo.type}:${errorInfo.message}:${stack}`);
  }

  _getPerformanceContext() {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav) return {};
    return {
      ttfb: Math.round(nav.responseStart - nav.startTime),
      domReady: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      loadTime: Math.round(nav.loadEventEnd - nav.startTime),
    };
  }

  _getBreadcrumbs() {
    // 简化实现：返回最近的点击记录
    return this._clickHistory?.slice(-5) || [];
  }

  // 批量上报
  flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.maxQueueSize);
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
        // 失败时放回队列
        this.queue.unshift(...batch);
      });
    }
  }

  _startFlushTimer() {
    setInterval(() => this.flush(), this.flushInterval);
  }

  _generateId() {
    return Math.random().toString(36).substring(2, 15);
  }

  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h.toString(36);
  }
}

// 使用
try {
  window.errorTracker = new ErrorTracker({
    endpoint: 'https://monitor.example.com/api/error',
    appKey: 'my-app',
    sampleRate: 0.5,
  });
} catch (e) {
  // SDK 初始化失败也不影响业务
  console.warn('ErrorTracker init failed:', e);
}
```
