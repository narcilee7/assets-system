// 并发模型：async/await
class AsyncBoundedBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = [];
        // TODO: 添加等待队列（notFull, notEmpty）
    }

    async produce(item) {
        // TODO: 若缓冲区满，等待 notFull；放入元素；通知 notEmpty
    }

    async consume() {
        // TODO: 若缓冲区空，等待 notEmpty；取出元素；通知 notFull；返回元素
        return 0;
    }
}

async function main() {
    const capacity = 10;
    const numProducers = 5;
    const numConsumers = 3;
    const itemsPerProducer = 100;

    const buffer = new AsyncBoundedBuffer(capacity);
    let sum = 0;

    const producers = Array.from({ length: numProducers }, (_, pid) =>
        (async () => {
            for (let j = 0; j < itemsPerProducer; j++) {
                await buffer.produce(pid * itemsPerProducer + j);
            }
        })()
    );

    const itemsPerConsumer = (numProducers * itemsPerProducer) / numConsumers;
    const consumers = Array.from({ length: numConsumers }, () =>
        (async () => {
            let localSum = 0;
            for (let j = 0; j < itemsPerConsumer; j++) {
                localSum += await buffer.consume();
            }
            sum += localSum;
        })()
    );

    await Promise.all([...producers, ...consumers]);

    const totalItems = numProducers * itemsPerProducer;
    const expected = (totalItems - 1) * totalItems / 2;
    if (sum === expected) {
        console.log(`PASS: sum = ${sum} (expected ${expected})`);
    } else {
        console.log(`FAIL: sum = ${sum} (expected ${expected})`);
    }
}

main().catch(console.error);
