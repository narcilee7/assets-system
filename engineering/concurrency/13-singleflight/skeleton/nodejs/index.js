// 并发模型：async/await
class Call {
    constructor() {
        // TODO: 添加 promise、resolve、reject、完成标记
    }
}

class Group {
    constructor() {
        this.m = new Map();
        this.mu = Promise.resolve();
    }

    async do(key, fn) {
        // TODO:
        // 1. 获取锁，检查 map 中是否已有进行中的 call
        // 2. 如果有，等待该 call 的 promise 并返回结果
        // 3. 如果没有，创建新的 call，放入 map，释放锁
        // 4. 执行 fn，将结果 resolve 给所有等待者
        // 5. 从 map 中删除 key
        return "", null;
    }

    // 辅助方法：用 Promise 模拟锁
    async _lock() {
        let release;
        const p = new Promise(r => { release = r; });
        const old = this.mu;
        this.mu = old.then(() => p);
        await old;
        return release;
    }
}

async function main() {
    const g = new Group();
    let execCount = 0;
    const n = 100;

    const tasks = Array.from({ length: n }, () =>
        g.do("key", async () => {
            execCount++;
            return "result";
        })
    );

    const results = await Promise.all(tasks);
    const allOk = results.every(r => r === "result");

    if (execCount === 1 && allOk) {
        console.log(`PASS: ${n} concurrent requests deduped to ${execCount} execution`);
    } else {
        console.log(`FAIL: execCount=${execCount}, allOk=${allOk}`);
    }
}

main().catch(console.error);
