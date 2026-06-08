// 并发模型：worker_threads（真并行）
const { Worker, isMainThread, workerData } = require('worker_threads');

if (isMainThread) {
    const n = 100;
    const m = 1000;

    // 共享计数器（4 字节 Int32）
    const sharedCount = new SharedArrayBuffer(4);
    const countArray = new Int32Array(sharedCount);
    Atomics.store(countArray, 0, 0);

    // 共享锁状态（0=未锁定, 1=已锁定）
    const sharedLock = new SharedArrayBuffer(4);
    const lockArray = new Int32Array(sharedLock);
    Atomics.store(lockArray, 0, 0);

    const workers = [];
    for (let i = 0; i < n; i++) {
        workers.push(new Worker(__filename, {
            workerData: { sharedCount, sharedLock, m }
        }));
    }

    let done = 0;
    for (const w of workers) {
        w.on('exit', () => {
            done++;
            if (done === n) {
                const actual = Atomics.load(countArray, 0);
                const expected = n * m;
                if (actual === expected) {
                    console.log(`PASS: count = ${actual} (expected ${expected})`);
                } else {
                    console.log(`FAIL: count = ${actual} (expected ${expected})`);
                }
            }
        });
    }
} else {
    const { sharedCount, sharedLock, m } = workerData;
    const countArray = new Int32Array(sharedCount);
    const lockArray = new Int32Array(sharedLock);

    // TODO: 实现基于 Atomics 的 lock() 和 unlock()
    function lock() {
        // 提示：使用 Atomics.compareExchange 自旋，或 Atomics.wait 阻塞等待
    }

    function unlock() {
        // 提示：释放锁并唤醒等待者
    }

    for (let i = 0; i < m; i++) {
        // TODO: 用 lock/unlock 保护递增操作
        const old = Atomics.load(countArray, 0);
        Atomics.store(countArray, 0, old + 1);
    }
}
