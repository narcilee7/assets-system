const autocannon = require('autocannon');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';

const SCENARIOS = [
  {
    name: 'phase1-bad',
    path: '/api/customers/list/phase1?status=active',
    connections: 5,
    duration: 5,
    measureSize: false,
  },
  {
    name: 'phase2-indexed',
    path: '/api/customers/list/phase2?status=active&page=1&pageSize=20',
    connections: 10,
    duration: 10,
    measureSize: true,
  },
  {
    name: 'phase3-batch-in',
    path: '/api/customers/list/phase3?status=active&page=1&pageSize=20',
    connections: 10,
    duration: 10,
    measureSize: true,
  },
  {
    name: 'phase4-denormalized',
    path: '/api/customers/list/phase4?status=active&page=1&pageSize=20',
    connections: 10,
    duration: 10,
    measureSize: true,
  },
  {
    name: 'phase5-cached',
    path: '/api/customers/list/phase5?status=active&page=1&pageSize=20',
    connections: 50,
    duration: 10,
    measureSize: true,
  },
];

async function measureBodySize(path) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.text();
  return body.length;
}

async function runScenario(scenario) {
  console.log(`\n→ Benchmarking ${scenario.name}: ${scenario.path}`);
  const result = await autocannon({
    url: `${BASE}${scenario.path}`,
    connections: scenario.connections,
    duration: scenario.duration,
    pipelining: 1,
    silent: true,
  });

  let bodySize = null;
  if (scenario.measureSize) {
    try {
      bodySize = await measureBodySize(scenario.path);
    } catch (e) {
      bodySize = 'error';
    }
  }

  return {
    name: scenario.name,
    connections: scenario.connections,
    duration: scenario.duration,
    p50: result.latency.p50,
    p99: result.latency.p99,
    avgLatency: result.latency.average,
    rps: result.requests.average,
    throughput: result.throughput.average,
    errors: result.errors,
    bodySize,
  };
}

function formatBytes(bytes) {
  if (bytes === null || bytes === 'error') return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const rows = [];
  for (const scenario of SCENARIOS) {
    try {
      const row = await runScenario(scenario);
      rows.push(row);
    } catch (err) {
      console.error(`Failed to benchmark ${scenario.name}:`, err.message);
      rows.push({
        name: scenario.name,
        connections: scenario.connections,
        duration: scenario.duration,
        error: err.message,
      });
    }
  }

  console.log('\n==================== 压测结果 ====================');
  console.log(
    ['Phase', 'Conn', 'Dur(s)', 'P50(ms)', 'P99(ms)', 'Avg(ms)', 'RPS', 'Errors', 'Body'].map((h) => h.padEnd(12)).join('')
  );
  for (const r of rows) {
    if (r.error) {
      console.log(`${r.name.padEnd(12)} ${String(r.connections).padEnd(12)} ${String(r.duration).padEnd(12)} ERROR: ${r.error}`);
      continue;
    }
    console.log(
      [
        r.name.padEnd(12),
        String(r.connections).padEnd(12),
        String(r.duration).padEnd(12),
        String(r.p50).padEnd(12),
        String(r.p99).padEnd(12),
        String(r.avgLatency).padEnd(12),
        String(Math.round(r.rps)).padEnd(12),
        String(r.errors).padEnd(12),
        formatBytes(r.bodySize).padEnd(12),
      ].join('')
    );
  }
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
