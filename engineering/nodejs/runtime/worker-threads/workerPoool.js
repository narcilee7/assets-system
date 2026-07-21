const { Worker } = require("worker_threads")

const os = require('os')

class WorkerPool {
    constructor(script, poolSize = os.cpus().length) {
        this.workerScript = script
        this.poolSize = poolSize
        this.workers = []
        this.queue = []
        this.init()
    }

    _init() {
        for (let i = 0; i < this.poolSize; i++) {
            this.addWorker()
        }
    }

    addWorker() {
        const worker = new Worker(this.workerScript)
        worker.on("message", (res) => {
            if (worker.resolve) {
                worker.resolve(res)
            }
            worker.resolve = worker.reject = null
            this.workers.push(worker)
        })
    }
}