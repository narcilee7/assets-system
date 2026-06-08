# Node.js Background Jobs

## 生态

| 工具 | 场景 |
| --- | --- |
| BullMQ | Redis-based job queue |
| Agenda | MongoDB-based scheduling |
| Bree | worker_threads based jobs |
| node-cron | simple cron |

## 必会问题

- job id 和幂等。
- retry backoff。
- delayed job。
- dead letter queue。
- concurrency。
- stalled job。
- graceful shutdown。

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| BullMQ worker architecture | `bullmq-architecture/` | Queue、Worker、事件监听 |
| retry and DLQ design | `bullmq-architecture/src/producer.ts` | 指数退避、重试策略 |
| scheduled job with idempotency | `bullmq-architecture/src/idempotent-job.ts` | jobId 幂等、重复入队防护 |
| graceful shutdown | `bullmq-architecture/src/graceful-shutdown.ts` | SIGTERM/SIGINT 优雅关闭 |
