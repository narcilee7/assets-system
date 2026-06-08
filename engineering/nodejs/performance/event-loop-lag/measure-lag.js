const { monitorEventLoopDelay } = require('perf_hooks');

const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();

setInterval(() => {
  h.disable();
  console.log({
    min: h.min / 1e6,
    max: h.max / 1e6,
    mean: h.mean / 1e6,
    stddev: h.stddev / 1e6,
    percentiles: {
      p50: h.percentile(50) / 1e6,
      p99: h.percentile(99) / 1e6,
    },
  });
  h.reset();
  h.enable();
}, 5000);
