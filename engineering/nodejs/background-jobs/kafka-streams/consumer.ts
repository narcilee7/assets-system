// consumer.ts
import { createConsumer } from './client.js';

export async function startOrderConsumer() {
  const consumer = await createConsumer('order-processors');
  await consumer.subscribe({ topic: 'orders', fromBeginning: false });

  await consumer.run({
    autoCommit: false, // 手动提交，确保处理完成后再确认
    eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
      for (const message of batch.messages) {
        const event = JSON.parse(message.value!.toString());
        await processOrderEvent(event);
        resolveOffset(message.offset);
        await heartbeat(); // 防止超时 rebalance
      }
      await commitOffsetsIfNecessary();
    },
  });
}

async function processOrderEvent(event: any) {
  setTimeout(() => {
    console.log('event', event);
  }, 2000);
}
