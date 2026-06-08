// 并发模型：async/await + AbortController
class CancelContext {
    constructor() {
        this.controller = new AbortController();
        this.tasks = [];
    }

    cancel() {
        // TODO: 触发 abort，等待所有子任务结束
    }

    async go(f) {
        // TODO: 启动异步任务，传入 signal；任务结束后从 tasks 中移除
    }
}

async function main() {
    const ctx = new CancelContext();
    let active = 0;

    for (let i = 0; i < 5; i++) {
        const id = i;
        ctx.go(async (signal) => {
            active++;
            try {
                while (!signal.aborted) {
                    await new Promise(r => setTimeout(r, 50));
                }
                console.log(`worker ${id} cancelled`);
            } finally {
                active--;
            }
        });
    }

    await new Promise(r => setTimeout(r, 100));
    await ctx.cancel();

    if (active === 0) {
        console.log("PASS: all workers exited after cancellation");
    } else {
        console.log(`FAIL: ${active} workers still active after cancellation`);
    }
}

main().catch(console.error);
