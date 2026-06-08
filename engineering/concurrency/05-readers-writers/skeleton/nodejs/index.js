// 并发模型：async/await
class AsyncReadersWriters {
    constructor() {
        this.readerCount = 0;
        this.writerActive = false;
        this.writerWaiting = 0;
        this.queue = [];
    }

    async startRead() {
        // TODO: 如果有写者等待或活跃，入队等待；否则增加 readerCount
    }

    async endRead() {
        // TODO: 减少 readerCount；如果是最后一个读者且有写者等待，唤醒写者
    }

    async startWrite() {
        // TODO: 如果有读者或写者活跃，入队等待；否则标记 writerActive
    }

    async endWrite() {
        // TODO: 取消 writerActive；优先唤醒等待的写者，否则唤醒所有等待的读者
    }

    _resolveNext() {
        // TODO: 根据等待队列和当前状态决定唤醒策略
    }
}

async function main() {
    const rw = new AsyncReadersWriters();
    let writeOccurred = false;

    const readers = Array.from({ length: 50 }, () =>
        (async () => {
            for (let i = 0; i < 10; i++) {
                await rw.startRead();
                await new Promise(r => setTimeout(r, 1));
                await rw.endRead();
            }
        })()
    );

    const writer = (async () => {
        await rw.startWrite();
        writeOccurred = true;
        await new Promise(r => setTimeout(r, 5));
        await rw.endWrite();
    })();

    await Promise.all([...readers, writer]);
    if (writeOccurred) {
        console.log("PASS: writer was not starved");
    } else {
        console.log("FAIL: writer starved or error");
    }
}

main().catch(console.error);
