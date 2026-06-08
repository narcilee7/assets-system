# 手写 Metrics 收集器

## 目标

实现一个简化版 Metrics 收集器，支持：
1. Counter（计数器）
2. Gauge（仪表盘）
3. Histogram（直方图）
4. 标签（Label）支持
5. Prometheus 格式导出
6. 聚合与查询

## 实现

```javascript
// metrics-collector.js

class MetricsRegistry {
  constructor() {
    this.metrics = new Map();
    this.collectors = [];
  }

  counter(name, help, labels = []) {
    const metric = new Counter(name, help, labels);
    this.metrics.set(name, metric);
    return metric;
  }

  gauge(name, help, labels = []) {
    const metric = new Gauge(name, help, labels);
    this.metrics.set(name, metric);
    return metric;
  }

  histogram(name, help, labels = [], buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
    const metric = new Histogram(name, help, labels, buckets);
    this.metrics.set(name, metric);
    return metric;
  }

  // Prometheus 文本格式导出
  export() {
    const lines = [];
    for (const metric of this.metrics.values()) {
      lines.push(...metric.export());
    }
    return lines.join('\n');
  }

  // 获取快照（用于内存存储）
  snapshot() {
    const result = {};
    for (const [name, metric] of this.metrics) {
      result[name] = metric.snapshot();
    }
    return result;
  }
}

// ========== Counter ==========

class Counter {
  constructor(name, help, labelNames) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.values = new Map(); // "label_values" -> count
  }

  inc(labels = {}, amount = 1) {
    const key = this._key(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + amount);
  }

  get(labels = {}) {
    return this.values.get(this._key(labels)) || 0;
  }

  export() {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const [key, value] of this.values) {
      const labels = this._parseKey(key);
      const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
      lines.push(`${this.name}{${labelStr}} ${value}`);
    }
    return lines;
  }

  snapshot() {
    return Object.fromEntries(this.values);
  }

  _key(labels) {
    return this.labelNames.map((l) => `${l}=${labels[l] || ''}`).join(',');
  }

  _parseKey(keyStr) {
    const labels = {};
    keyStr.split(',').forEach((part) => {
      const [k, v] = part.split('=');
      labels[k] = v;
    });
    return labels;
  }
}

// ========== Gauge ==========

class Gauge {
  constructor(name, help, labelNames) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.values = new Map();
  }

  set(labels = {}, value) {
    this.values.set(this._key(labels), value);
  }

  inc(labels = {}, amount = 1) {
    const key = this._key(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + amount);
  }

  dec(labels = {}, amount = 1) {
    this.inc(labels, -amount);
  }

  get(labels = {}) {
    return this.values.get(this._key(labels)) || 0;
  }

  export() {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    for (const [key, value] of this.values) {
      const labels = this._parseKey(key);
      const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
      lines.push(`${this.name}{${labelStr}} ${value}`);
    }
    return lines;
  }

  snapshot() {
    return Object.fromEntries(this.values);
  }

  _key(labels) {
    return this.labelNames.map((l) => `${l}=${labels[l] || ''}`).join(',');
  }

  _parseKey(keyStr) {
    const labels = {};
    keyStr.split(',').forEach((part) => {
      const [k, v] = part.split('=');
      labels[k] = v;
    });
    return labels;
  }
}

// ========== Histogram ==========

class Histogram {
  constructor(name, help, labelNames, buckets) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.buckets = [...buckets, '+Inf'];
    this.counts = new Map(); // key -> { bucket_counts: {}, sum: 0, count: 0 }
  }

  observe(labels = {}, value) {
    const key = this._key(labels);
    if (!this.counts.has(key)) {
      this.counts.set(key, {
        bucket_counts: Object.fromEntries(this.buckets.map((b) => [b, 0])),
        sum: 0,
        count: 0,
      });
    }

    const data = this.counts.get(key);
    data.sum += value;
    data.count += 1;

    for (const bucket of this.buckets) {
      if (bucket === '+Inf' || value <= bucket) {
        data.bucket_counts[bucket]++;
      }
    }
  }

  export() {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    for (const [key, data] of this.counts) {
      const labels = this._parseKey(key);
      const baseLabels = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');

      for (const bucket of this.buckets) {
        const bucketLabel = baseLabels ? `${baseLabels},le="${bucket}"` : `le="${bucket}"`;
        lines.push(`${this.name}_bucket{${bucketLabel}} ${data.bucket_counts[bucket]}`);
      }

      const countLabel = baseLabels || '';
      if (countLabel) {
        lines.push(`${this.name}_count{${countLabel}} ${data.count}`);
        lines.push(`${this.name}_sum{${countLabel}} ${data.sum}`);
      } else {
        lines.push(`${this.name}_count ${data.count}`);
        lines.push(`${this.name}_sum ${data.sum}`);
      }
    }
    return lines;
  }

  snapshot() {
    return Object.fromEntries(this.counts);
  }

  // 计算分位数
  quantile(labels = {}, q) {
    const key = this._key(labels);
    const data = this.counts.get(key);
    if (!data || data.count === 0) return 0;

    const target = q * data.count;
    let cumulative = 0;

    for (const bucket of this.buckets) {
      if (bucket === '+Inf') continue;
      cumulative += data.bucket_counts[bucket];
      if (cumulative >= target) {
        return bucket;
      }
    }
    return Infinity;
  }

  _key(labels) {
    return this.labelNames.map((l) => `${l}=${labels[l] || ''}`).join(',');
  }

  _parseKey(keyStr) {
    const labels = {};
    keyStr.split(',').forEach((part) => {
      const [k, v] = part.split('=');
      labels[k] = v;
    });
    return labels;
  }
}

// ========== 使用 ==========

const registry = new MetricsRegistry();

// Counter
const httpRequests = registry.counter('http_requests_total', 'Total HTTP requests', ['method', 'status']);
httpRequests.inc({ method: 'GET', status: '200' });
httpRequests.inc({ method: 'GET', status: '200' });
httpRequests.inc({ method: 'POST', status: '500' });

// Gauge
const activeConnections = registry.gauge('active_connections', 'Active connections', ['service']);
activeConnections.set({ service: 'api' }, 42);
activeConnections.inc({ service: 'api' });

// Histogram
const requestDuration = registry.histogram('request_duration_seconds', 'Request duration', ['method'],
  [0.01, 0.05, 0.1, 0.5, 1.0]);
requestDuration.observe({ method: 'GET' }, 0.023);
requestDuration.observe({ method: 'GET' }, 0.15);
requestDuration.observe({ method: 'GET' }, 0.8);
requestDuration.observe({ method: 'POST' }, 0.3);

// 导出 Prometheus 格式
console.log(registry.export());

// 计算 P99
console.log('P99 GET:', requestDuration.quantile({ method: 'GET' }, 0.99));

// HTTP endpoint
// const http = require('http');
// http.createServer((req, res) => {
//   if (req.url === '/metrics') {
//     res.setHeader('Content-Type', 'text/plain');
//     res.end(registry.export());
//   }
// }).listen(9090);

module.exports = { MetricsRegistry, Counter, Gauge, Histogram };
```
