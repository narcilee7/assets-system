// 并发模型：async/await
class WorkerPool {
    constructor(workerCount) {
        this.workerCount = workerCount;
        this.tasks = [];
        this.results = [];
        this.closed = false;
        this.workers = [];
        this.resolvers = [];
        // TODO: 启动 workerCount 个异步 worker
    }

    submit(task) {
        // TODO: 如果已关闭返回 false；否则将任务放入队列，触发 worker 调度
        return false;
    }

    async nextResult() {
        // TODO: 如果结果队列为空且所有任务已完成，返回 null；否则返回下一个结果
    }

    shutdown() {
        // TODO: 标记关闭、等待所有 worker 结束
    }

    // TODO: 实现 worker 循环：不断从任务队列取任务执行，将结果存入结果队列
}

async function main() {
    const pool = new WorkerPool(4);
    const numTasks = 20;
    let expectedSum = 0;

    for (let i = 0; i < numTasks; i++) {
        expectedSum += i * i;
        pool.submit(() => i * i);
    }

    pool.shutdown();

    let actualSum = 0;
    let result;
    while ((result = await pool.nextResult()) !== null) {
        actualSum += result;
    }

    if (actualSum === expectedSum) {
        console.log(`PASS: sum = ${actualSum} (expected ${expectedSum})`);
    } else {
        console.log(`FAIL: sum = ${actualSum} (expected ${expectedSum})`);
    }

    if (pool.submit(() => 0)) {
        console.log("FAIL: expected rejection after shutdown");
    } else {
        console.log("PASS: shutdown correctly rejects new tasks");
    }
}

main().catch(console.error);
