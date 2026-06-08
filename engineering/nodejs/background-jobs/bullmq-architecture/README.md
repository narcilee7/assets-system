# BullMQ Job Architecture

BullMQ 是 Redis 驱动的 Node.js 任务队列，支持延迟任务、优先级、重试和分布式 worker。

## 核心组件

| 组件 | 角色 |
| --- | --- |
| Queue | 生产者向队列添加任务 |
| Worker | 消费者从队列取任务执行 |
| QueueEvents | 监听任务生命周期事件 |
| Job Scheduler | 重复任务（cron） |

## 核心实现

### 1. 队列与 Worker 定义

```ts
// queue.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({ maxRetriesPerRequest: null });

export const emailQueue = new Queue('email', { connection });
export const reportQueue = new Queue('report', { connection });
```

```ts
// worker.ts
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({ maxRetriesPerRequest: null });

export const emailWorker = new Worker(
  'email',
  async (job: Job<{ to: string; subject: string; body: string }>) => {
    console.log(`Sending email to ${job.data.to}`);
    // 模拟发送
    await new Promise((r) => setTimeout(r, 500));
    return { sent: true };
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }, // 每秒最多 10 封
  }
);

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});
```

### 2. 延迟任务与重试策略

```ts
// producer.ts
import { emailQueue } from './queue';

export async function scheduleWelcomeEmail(userId: string, email: string) {
  await emailQueue.add(
    'welcome',
    { to: email, subject: 'Welcome!', body: 'Thanks for joining.' },
    {
      delay: 60_000, // 1 分钟后执行
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 10, // 保留最近 10 条完成记录
      removeOnFail: 5,
    }
  );
}
```

### 3. 幂等性设计

```ts
// idempotent-job.ts
import { emailQueue } from './queue';

export async function enqueueIdempotent(jobId: string, data: any) {
  // 使用 jobId 作为 deduplication key
  const existing = await emailQueue.getJob(jobId);
  if (existing && await existing.getState() !== 'completed') {
    return { jobId: existing.id, status: 'already-queued' };
  }
  const job = await emailQueue.add(jobId, data, { jobId });
  return { jobId: job.id, status: 'queued' };
}
```

### 4. 优雅关闭

```ts
// graceful-shutdown.ts
import { emailWorker, reportWorker } from './worker';
import { emailQueue, reportQueue } from './queue';

async function shutdown() {
  console.log('Shutting down workers...');
  await emailWorker.close();
  await reportWorker.close();
  await emailQueue.close();
  await reportQueue.close();
  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## 架构图

```
[API Server] --add(job)--> [Redis Queue]
                                |
                                v
                          [Worker Node 1]
                          [Worker Node 2]
                          [Worker Node N]
```

## 生产 checklist

- [ ] Worker `concurrency` 根据 CPU 和任务类型调整，IO 密集型可设高。
- [ ] 使用 `jobId` 实现幂等，防止网络超时导致重复入队。
- [ ] 设置 `removeOnComplete` / `removeOnFail`，避免 Redis 内存膨胀。
- [ ] 监控 stalled jobs（BullMQ 自动检测，但需设置 `stalledInterval`）。
- [ ] 独立部署 Worker 进程，与 API Server 分离，方便独立扩缩容。
