import { producer } from './client.js';


export async function publishOrderEvent(order: any) {
  await producer.send({
    topic: 'orders',
    messages: [
      {
        key: order.userId, // 相同 userId 进入同一 Partition，保证用户内有序
        value: JSON.stringify(order),
        headers: {
          'event-type': 'order:created',
          'version': '1.0',
        },
      },
    ],
  });
}

// 批量发送
export async function publishBatch(events: any[]) {
  await producer.sendBatch({
    topicMessages: [
      {
        topic: 'orders',
        messages: events.map((e) => ({
          key: e.userId,
          value: JSON.stringify(e),
        })),
      },
    ],
  });
}
