# 手写 Performance Observer

## 1. Web Vitals 采集

```javascript
// mini-perf-observer.js

class PerfObserver {
  constructor(options = {}) {
    this.onMetric = options.onMetric || console.log;
    this.metrics = {};
  }

  init() {
    this.observeLCP();
    this.observeCLS();
    this.observeINP();
    this.observeFCP();
    this.observeTTFB();
    this.observeLongTasks();
    this.observeResources();
  }

  // ============ LCP ============
  observeLCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];

      this.metrics.lcp = {
        name: 'LCP',
        value: lastEntry.startTime,
        element: lastEntry.element?.tagName,
        url: lastEntry.url,
        rating: this.getRating('LCP', lastEntry.startTime),
      };

      this.report(this.metrics.lcp);
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  }

  // ============ CLS ============
  observeCLS() {
    let clsValue = 0;
    let clsEntries = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push(entry);
        }
      }
    });

    observer.observe({ entryTypes: ['layout-shift'] });

    // 页面卸载时报告最终值
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.metrics.cls = {
          name: 'CLS',
          value: clsValue,
          entries: clsEntries.length,
          rating: this.getRating('CLS', clsValue),
        };
        this.report(this.metrics.cls);
      }
    });
  }

  // ============ INP ============
  observeINP() {
    const interactions = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.interactionId > 0) {
          interactions.push({
            duration: entry.duration,
            type: entry.name,  // pointerdown | keydown
            target: entry.target?.tagName,
          });
        }
      }
    });

    observer.observe({ entryTypes: ['event'], buffered: true });

    // 报告最慢的交互
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && interactions.length > 0) {
        const sorted = interactions.sort((a, b) => b.duration - a.duration);
        const inp = sorted[0];

        this.metrics.inp = {
          name: 'INP',
          value: inp.duration,
          rating: this.getRating('INP', inp.duration),
        };
        this.report(this.metrics.inp);
      }
    });
  }

  // ============ FCP ============
  observeFCP() {
    const observer = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      if (entry) {
        this.metrics.fcp = {
          name: 'FCP',
          value: entry.startTime,
          rating: this.getRating('FCP', entry.startTime),
        };
        this.report(this.metrics.fcp);
      }
    });

    observer.observe({ entryTypes: ['paint'] });
  }

  // ============ TTFB ============
  observeTTFB() {
    window.addEventListener('load', () => {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) {
        this.metrics.ttfb = {
          name: 'TTFB',
          value: nav.responseStart,
          rating: this.getRating('TTFB', nav.responseStart),
        };
        this.report(this.metrics.ttfb);
      }
    });
  }

  // ============ Long Tasks ============
  observeLongTasks() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.report({
          name: 'LongTask',
          value: entry.duration,
          startTime: entry.startTime,
          attribution: entry.attribution?.map((a) => ({
            type: a.entryType,
            container: a.containerName,
          })),
        });
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  }

  // ============ Resources ============
  observeResources() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.report({
          name: 'Resource',
          url: entry.name,
          type: entry.initiatorType,
          duration: entry.duration,
          transferSize: entry.transferSize,
          decodedSize: entry.decodedBodySize,
          cache: entry.transferSize === 0 ? 'hit' : 'miss',
        });
      }
    });

    observer.observe({ entryTypes: ['resource'] });
  }

  // ============ 评分标准 ============
  getRating(name, value) {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      INP: { good: 200, poor: 500 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 },
    };

    const t = thresholds[name];
    if (!t) return 'unknown';

    if (value <= t.good) return 'good';
    if (value <= t.poor) return 'needs-improvement';
    return 'poor';
  }

  report(metric) {
    this.onMetric(metric);
  }

  getAllMetrics() {
    return this.metrics;
  }
}

// ============ 使用 ============
const perf = new PerfObserver({
  onMetric: (metric) => {
    console.log(`[${metric.name}] ${metric.value} (${metric.rating})`);
  },
});

perf.init();

// 获取所有指标
window.addEventListener('load', () => {
  setTimeout(() => {
    console.log('All metrics:', perf.getAllMetrics());
  }, 1000);
});
```
