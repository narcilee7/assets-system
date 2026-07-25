import { Kafka, Producer, Consumer, Partitioners } from 'kafkajs';


const kafka = new Kafka({
  clientId: 'my-app',
  brokers: process.env.KAFKA_BROKERS!.split(','),
  retry: { initialRetryTime: 300, retries: 5 },
});

export const producer: Producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
  idempotent: true, // 幂等生产者
  transactionalId: 'my-transactional-producer',
});

export async function createConsumer(groupId: string): Promise<Consumer> {
  return kafka.consumer({
    groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });
}
