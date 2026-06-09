import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({ maxRetriesPerRequest: null });

export const emailWorker = new Worker(
  'email',
  async (job: Job<{ to: string; subject: string; body: string }>) => {
    console.log(`Sending email to ${job.data.to}`);
    await new Promise((r) => setTimeout(r, 500));
    return { sent: true };
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  }
);

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});
