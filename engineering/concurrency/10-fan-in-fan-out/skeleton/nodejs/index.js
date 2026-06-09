// 并发模型：async/await
async function* generate(n) {
    for (let i = 1; i <= n; i++) yield i;
}

async function squareWorker(source, output) {
    // TODO: for await (const x of source) 将 x*x push 到 output 数组
}

async function fanOut(source, numWorkers) {
    // TODO:
    // 1. 创建 numWorkers 个异步任务，每个消费同一个 source
    // 2. 由于 async generator 只能被一个消费者遍历，你需要实现一个 tee / 广播机制
    //    或者：先将所有数据收集到数组，再分发给各 worker（简单方案）
    // 3. 合并所有 worker 的输出，返回合并后的 async iterable
}

async function sum(source) {
    let s = 0;
    for await (const x of source) s += x;
    return s;
}

async function main() {
    const n = 100;
    const workers = 4;
    const expected = (n * (n + 1) * (2 * n + 1)) / 6;

    const gen = generate(n);
    const merged = await fanOut(gen, workers);
    const actual = await sum(merged);

    if (actual === expected) {
        console.log(`PASS: sum = ${actual} (expected ${expected}) with ${workers} workers`);
    } else {
        console.log(`FAIL: sum = ${actual} (expected ${expected})`);
    }
}

main().catch(console.error);
