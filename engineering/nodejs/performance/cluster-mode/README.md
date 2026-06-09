# Cluster Mode

Node.js cluster 模块让单个服务利用多核 CPU，是 I/O 密集型服务的基础扩展手段。

## 核心实现

### 1. 原生 Cluster

```ts
// cluster.ts
import cluster from 'cluster';
import os from 'os';
import { createServer } from 'http';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  const server = createServer((req, res) => {
    res.writeHead(200);
    res.end(`Hello from worker ${process.pid}\n`);
  });
  server.listen(3000);
  console.log(`Worker ${process.pid} started`);
}
```

### 2. PM2 Cluster（生产推荐）

```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api',
    script: './dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
  }],
};
```

### 3. Sticky Session（WebSocket 场景）

```ts
// sticky-session.ts
import cluster from 'cluster';
import net from 'net';

const workers: cluster.Worker[] = [];

if (cluster.isPrimary) {
  for (let i = 0; i < os.cpus().length; i++) {
    workers.push(cluster.fork());
  }

  // 基于客户端 IP 哈希分发
  const server = net.createServer({ pauseOnConnect: true }, (connection) => {
    const workerIndex = hashIp(connection.remoteAddress || '') % workers.length;
    workers[workerIndex].send('sticky-session:connection', connection);
  });

  server.listen(3000);
} else {
  const server = createServer();
  process.on('message', (msg, connection) => {
    if (msg === 'sticky-session:connection') {
      server.emit('connection', connection);
      connection.resume();
    }
  });
  // WebSocket upgrade...
}

function hashIp(ip: string): number {
  return ip.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}
```

## Cluster vs Worker Threads

| 维度 | Cluster | Worker Threads |
| --- | --- | --- |
| 进程/线程 | 进程 | 线程 |
| 共享内存 | ❌ | SharedArrayBuffer |
| 适用 | I/O 密集型 HTTP | CPU 密集型计算 |
| 崩溃隔离 | ✅ 单个 worker 崩溃不影响其他 | 单个线程崩溃整个进程 |
| 状态共享 | Redis / 数据库 | Atomics / MessagePort |

> 现代推荐：HTTP 服务用 PM2 cluster，CPU 任务用 worker_threads，两者可共存。
