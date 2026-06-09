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
