const { WorkerPool } = require('../../runtime/worker-threads/worker-pool');

const pool = new WorkerPool('../../runtime/worker-threads/fib-worker.js', 4);

async function run() {
  console.time('worker-pool');
  const tasks = [35, 35, 35, 35];
  const results = await Promise.all(tasks.map((n) => pool.execute(n)));
  console.log(results);
  console.timeEnd('worker-pool');
  await pool.terminate();
}

run();
