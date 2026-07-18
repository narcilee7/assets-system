import { producer } from "./client.js";

export async function transferBetweenTopics(
  sourceTopic: string,
  targetTopic: string,
  message: any,
) {
  const transaction = await producer.transaction();
  try {
    await transaction.send({
      topic: targetTopic,
      messages: [{ value: JSON.stringify(message) }],
    });
    await transaction.sendOffsets({
      consumerGroupId: 'my-group',
      topics: [{ topic: sourceTopic, partitions: [{ partition: 0, offset: '10' }] }],
    });
    await transaction.commit();
  } catch (err) {
    await transaction.abort();
    throw err;
  }
}
