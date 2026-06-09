import { register, Histogram } from 'prom-client';
import { monitorEventLoopDelay } from 'perf_hooks';
import express from 'express';

const eventLoopLag = new Histogram({
  name: 'nodejs_event_loop_lag_seconds',
  help: 'Event loop lag in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();

setInterval(() => {
  h.disable();
  eventLoopLag.observe(h.mean / 1e9);
  h.reset();
  h.enable();
}, 5000);

const app = express();
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
app.listen(9090, () => console.log('Metrics on :9090'));
