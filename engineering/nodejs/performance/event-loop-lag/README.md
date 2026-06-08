# Event Loop Lag Diagnosis

Event loop lag 是 Node.js 性能问题的首要指标。它直接反映事件循环被阻塞的时长。

## 测量方法

### 1. 基础测量

```js
// measure-lag.js
const { monitorEventLoopDelay } = require('perf_hooks');

const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();

setInterval(() => {
  h.disable();
  console.log({
    min: h.min / 1e6,       // ms
    max: h.max / 1e6,       // ms
    mean: h.mean / 1e6,     // ms
    stddev: h.stddev / 1e6, // ms
    percentiles: {
      p50: h.percentile(50) / 1e6,
      p99: h.percentile(99) / 1e6,
    },
  });
  h.reset();
  h.enable();
}, 5000);
```

### 2. 暴露为 Prometheus 指标

```ts
// event-loop-metric.ts
import { register, Histogram } from 'prom-client';
import { monitorEventLoopDelay } from 'perf_hooks';

const eventLoopLag = new Histogram({
  name: 'nodejs_event_loop_lag_seconds',
  help: 'Event loop lag in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();

setInterval(() => {
  h.disable();
  eventLoopLag.observe(h.mean / 1e9); // nanoseconds -> seconds
  h.reset();
  h.enable();
}, 5000);

// HTTP 指标端点
import express from 'express';
const app = express();
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
app.listen(9090);
```

## 常见阻塞源

| 源 | 症状 | 解决 |
| --- | --- | --- |
| 同步文件读取 | 偶发卡顿 | 改为 `fs.promises` / Stream |
| JSON.parse 大对象 | 周期性高 lag | 使用 streaming parser |
| 正则回溯 | CPU 100% | 限制输入长度、优化正则 |
| 复杂计算 | 持续高 lag | 移至 worker_threads |
| 内存 GC | 波动型 lag | 减少临时对象、调高 heap |

## clinic.js 分析

```bash
npm install -g clinic
clinic doctor -- node app.js
clinic bubbleprof -- node app.js
clinic flame -- node app.js
```
