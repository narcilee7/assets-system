# Worker Thread CPU Benchmark

对比单线程事件循环与 worker_threads 在处理 CPU 密集型任务时的性能差异。

## 基准测试

### 1. 单线程阻塞测试

```js
// single-thread.js
function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

console.time('single-thread');
const results = [35, 35, 35, 35].map(fib);
console.log(results);
console.timeEnd('single-thread');
// 约 4 * 80ms = 320ms，期间 event loop 完全被阻塞
```

### 2. Worker Pool 并行测试

```js
// worker-benchmark.js
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
// 约 80ms（4 核并行），event loop 完全不被阻塞
```

### 3. HTTP 服务中对比

```js
// http-comparison.js
const http = require('http');
const { WorkerPool } = require('../../runtime/worker-threads/worker-pool');

const pool = new WorkerPool('../../runtime/worker-threads/fib-worker.js', 4);

const server = http.createServer(async (req, res) => {
  if (req.url === '/blocking') {
    const result = fib(40); // 阻塞 1s+
    res.end(JSON.stringify({ result }));
  } else if (req.url === '/worker') {
    const result = await pool.execute(40); // 不阻塞
    res.end(JSON.stringify({ result }));
  } else {
    res.end('ok');
  }
});

server.listen(3000);
```

## 测试结果预期

| 场景 | 耗时 | Event Loop 状态 |
| --- | --- | --- |
| 单线程串行 fib(35) x4 | ~320ms | 阻塞 |
| Worker Pool x4 | ~80ms | 自由 |
| 单线程 fib(40) HTTP | ~1200ms | 全部请求排队 |
| Worker fib(40) HTTP | ~1200ms | 其他请求正常响应 |

## 结论

- CPU 密集型任务必须放入 worker_threads。
- Worker 通信有序列化开销，小任务（< 5ms）不适合。
- Worker Pool 大小 = CPU 核心数，避免超线程竞争。
