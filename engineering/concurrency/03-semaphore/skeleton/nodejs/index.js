// 并发模型：async/await
class AsyncSemaphore {
    constructor(n) {
        this.capacity = n;
        this.available = n;
        this.queue = [];
    }

    async acquire() {
        // TODO: 如果 available > 0，减 1 后继续；否则将 resolve 函数入队等待
    }

    release() {
        // TODO: available 加 1，如果有等待者，唤醒队列中的第一个
    }
}

async function main() {
    const maxConcurrent = 5;
    const totalWorkers = 50;
    const sem = new AsyncSemaphore(maxConcurrent);
    let current = 0;
    let maxObserved = 0;

    const tasks = Array.from({ length: totalWorkers }, async () => {
        await sem.acquire();
        current++;
        if (current > maxObserved) maxObserved = current;
        await new Promise(r => setTimeout(r, 10));
        current--;
        sem.release();
    });

    await Promise.all(tasks);
    if (maxObserved <= maxConcurrent) {
        console.log(`PASS: max observed concurrency = ${maxObserved} (limit = ${maxConcurrent})`);
    } else {
        console.log(`FAIL: max observed concurrency = ${maxObserved} (limit = ${maxConcurrent})`);
    }
}

main().catch(console.error);
