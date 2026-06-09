// 并发模型：async/await（单线程事件循环中的并发控制）
class AsyncRWMutex {
    constructor() {
        this.readerCount = 0;
        this.writerActive = false;
        this.writerWaiting = 0;
        this.queue = [];
    }

    async rlock() {
        // TODO: 如果有活跃写者或等待写者，入队等待；否则直接获取读锁
    }

    async runlock() {
        // TODO: 减少 readerCount，如果是最后一个读者，唤醒等待的写者或读者
    }

    async lock() {
        // TODO: 如果有活跃读者或写者，入队等待；否则获取写锁
    }

    async unlock() {
        // TODO: 释放写锁，按策略唤醒等待的读者或写者
    }

    _resolveNext() {
        // TODO: 根据等待队列和当前状态，决定唤醒下一个读者还是写者
    }
}

async function main() {
    const rw = new AsyncRWMutex();
    let activeReaders = 0;
    let maxReaders = 0;
    let writeDuringRead = false;

    const readers = Array.from({ length: 10 }, (_, id) =>
        (async () => {
            await rw.rlock();
            activeReaders++;
            if (activeReaders > maxReaders) maxReaders = activeReaders;
            await new Promise(r => setTimeout(r, 20));
            activeReaders--;
            await rw.runlock();
        })()
    );

    const writers = Array.from({ length: 2 }, (_, id) =>
        (async () => {
            await rw.lock();
            if (activeReaders !== 0) {
                writeDuringRead = true;
                console.log(`FAIL: writer ${id} sees activeReaders=${activeReaders}`);
            }
            await new Promise(r => setTimeout(r, 20));
            await rw.unlock();
        })()
    );

    await Promise.all([...readers, ...writers]);
    if (!writeDuringRead) {
        console.log(`PASS: max concurrent readers = ${maxReaders}`);
    }
}

main().catch(console.error);
