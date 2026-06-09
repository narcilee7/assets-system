// 并发模型：async/await（模拟哲学家并发就餐）
class AsyncChopstick {
    constructor() {
        this.locked = false;
        this.queue = [];
    }

    async acquire() {
        // TODO: 如果已锁定，入队等待；否则直接获取
    }

    release() {
        // TODO: 释放，如果有等待者，唤醒下一个
    }
}

class Philosopher {
    constructor(id, left, right) {
        this.id = id;
        this.left = left;
        this.right = right;
    }

    async dine(eatCount) {
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 1));
            // TODO: 实现就餐逻辑，避免死锁
            await this.left.acquire();
            await this.right.acquire();
            eatCount.count++;
            await new Promise(r => setTimeout(r, 1));
            this.right.release();
            this.left.release();
        }
    }
}

async function main() {
    const numPhilosophers = 5;
    const chopsticks = Array.from({ length: numPhilosophers }, () => new AsyncChopstick());
    const philosophers = Array.from({ length: numPhilosophers }, (_, i) =>
        new Philosopher(i, chopsticks[i], chopsticks[(i + 1) % numPhilosophers])
    );

    const eatCount = { count: 0 };
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('deadlock')), 5000));
    const dine = Promise.all(philosophers.map(p => p.dine(eatCount)));

    try {
        await Promise.race([dine, timeout]);
        const expected = numPhilosophers * 10;
        if (eatCount.count === expected) {
            console.log(`PASS: all ${eatCount.count} meals completed without deadlock`);
        } else {
            console.log(`FAIL: eatCount=${eatCount.count} (expected ${expected})`);
        }
    } catch (e) {
        console.log("FAIL: timeout, likely deadlock");
    }
}

main().catch(console.error);
