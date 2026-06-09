# Worker Threads CPU Isolation

Node.js 是单线程事件循环。CPU 密集型任务会阻塞 I/O，worker_threads 提供了真正的多线程支持。

## 使用场景

- 图像/视频编解码
- 大数据排序/聚合
- 密码学计算（bcrypt、PBKDF2）
- JSON 超大对象序列化/反序列化

## 核心代码

### 1. 基础 Worker Pool

```js
// worker-pool.js
const { Worker } = require('worker_threads');
const os = require('os');

class WorkerPool {
  constructor(workerScript, poolSize = os.cpus().length) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
    this.workers = [];
    this.queue = [];
    this.init();
  }

  init() {
    for (let i = 0; i < this.poolSize; i++) {
      this.addWorker();
    }
  }

  addWorker() {
    const worker = new Worker(this.workerScript);
    worker.on('message', (result) => {
      if (worker.resolve) worker.resolve(result);
      worker.resolve = worker.reject = null;
      this.processQueue();
    });
    worker.on('error', (err) => {
      if (worker.reject) worker.reject(err);
    });
    this.workers.push(worker);
  }

  processQueue() {
    if (!this.queue.length) return;
    const available = this.workers.find((w) => !w.resolve);
    if (!available) return;
    const { task, resolve, reject } = this.queue.shift();
    available.resolve = resolve;
    available.reject = reject;
    available.postMessage(task);
  }

  execute(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  terminate() {
    return Promise.all(this.workers.map((w) => w.terminate()));
  }
}

module.exports = { WorkerPool };
```

### 2. CPU 密集型 Worker 任务

```js
// fib-worker.js
const { parentPort } = require('worker_threads');

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort.on('message', (n) => {
  const result = fib(n);
  parentPort.postMessage(result);
});
```

### 3. 主进程调用示例

```js
// main.js
const { WorkerPool } = require('./worker-pool');
const pool = new WorkerPool('./fib-worker.js', 4);

async function run() {
  console.time('worker-pool');
  const tasks = [35, 35, 35, 35];
  const results = await Promise.all(tasks.map((n) => pool.execute(n)));
  console.log(results);
  console.timeEnd('worker-pool');
  await pool.terminate();
}

run();
```

## 关键注意点

- Worker 不共享内存（除非使用 SharedArrayBuffer）。
- 线程间通信有序列化成本，小任务不适合 worker。
- `Atomics` + `SharedArrayBuffer` 可实现高性能并发数据结构。
- 使用 `worker_threads` 的线程数不要超过 CPU 核心数，否则上下文切换反噬性能。

## 对比 cluster

| 维度 | worker_threads | cluster |
| --- | --- | --- |
| 共享内存 | SharedArrayBuffer 可共享 | 进程隔离 |
| 适合 | CPU 密集型 | I/O 密集型、利用多核 |
| 通信 | MessagePort | IPC / 外部存储 |
| 崩溃影响 | 单个线程崩溃（可控） | 单个进程崩溃（PM2 重启） |
