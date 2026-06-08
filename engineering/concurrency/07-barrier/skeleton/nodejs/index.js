// 并发模型：async/await
class AsyncBarrier {
    constructor(n) {
        this.n = n;
        this.count = 0;
        this.generation = 0;
        this.waiting = [];
    }

    async wait() {
        // TODO:
        // 1. 记录当前代
        // 2. 增加到达计数
        // 3. 如果是最后一个到达：重置计数、增加代、resolve 所有等待的 promise
        // 4. 否则：返回一个在当前代 resolve 的 promise
    }
}

async function main() {
    const n = 5;
    const phases = 3;
    const barrier = new AsyncBarrier(n);
    const arrivalTimes = Array.from({ length: n }, () => []);

    const tasks = Array.from({ length: n }, (_, id) =>
        (async () => {
            for (let phase = 0; phase < phases; phase++) {
                await new Promise(r => setTimeout(r, id * 10));
                await barrier.wait();
                arrivalTimes[id][phase] = Date.now();
            }
        })()
    );

    await Promise.all(tasks);

    let pass = true;
    for (let phase = 0; phase < phases; phase++) {
        let maxDiff = 0;
        for (let i = 1; i < n; i++) {
            const diff = Math.abs(arrivalTimes[i][phase] - arrivalTimes[0][phase]);
            if (diff > maxDiff) maxDiff = diff;
        }
        if (maxDiff > 50) {
            console.log(`FAIL: phase ${phase} max arrival diff = ${maxDiff}ms`);
            pass = false;
        }
    }
    if (pass) console.log("PASS: all phases synchronized");
}

main().catch(console.error);
