# Distributed Task Scheduler Case Study

一个分布式任务调度系统，支持 cron 表达式、延迟任务、依赖任务和失败重试。

## 技术栈

- **Engine**: BullMQ + Redis
- **API**: Fastify
- **Database**: PostgreSQL（任务元数据）
- **Monitoring**: Bull Board

## 核心设计

```
[API] --create job--> [PostgreSQL]
                    |
                    v
               [BullMQ Queue]
                    |
                    v
               [Worker Pool]
                    |
        +-----------+-----------+
        v           v           v
   [Success]   [Retry]     [DLQ]
```

## 核心代码

### 1. Job Definition

```ts
// job.types.ts
interface JobDefinition {
  id: string;
  name: string;
  cron?: string;           // cron 表达式
  delay?: number;          // 延迟毫秒
  data: any;
  retries: number;
  backoff: 'fixed' | 'exponential';
  dependencies?: string[]; // 依赖任务 ID
}
```

### 2. Scheduler Service

```ts
// scheduler.service.ts
import { Queue, Worker, Job } from 'bullmq';

export class SchedulerService {
  private queue = new Queue('scheduler', { connection: redis });
  private worker = new Worker(
    'scheduler',
    async (job: Job) => this.executeJob(job),
    { connection: redis, concurrency: 5 }
  );

  async schedule(def: JobDefinition) {
    // 检查依赖
    if (def.dependencies?.length) {
      const deps = await this.getJobStatuses(def.dependencies);
      const unfinished = deps.filter((d) => d !== 'completed');
      if (unfinished.length) {
        await this.waitForDependencies(def.id, def.dependencies);
        return;
      }
    }

    await this.queue.add(def.name, def.data, {
      jobId: def.id,
      repeat: def.cron ? { cron: def.cron } : undefined,
      delay: def.delay,
      attempts: def.retries + 1,
      backoff: { type: def.backoff, delay: 2000 },
    });
  }

  private async executeJob(job: Job) {
    const handler = jobRegistry.get(job.name);
    if (!handler) throw new Error(`No handler for ${job.name}`);
    return handler(job.data);
  }
}
```

### 3. Dependency DAG

```ts
// dag.service.ts
export class DagService {
  private adj = new Map<string, Set<string>>();

  addEdge(from: string, to: string) {
    const set = this.adj.get(from) || new Set();
    set.add(to);
    this.adj.set(from, set);
  }

  async onJobComplete(jobId: string) {
    const dependents = this.adj.get(jobId);
    if (!dependents) return;

    for (const dep of dependents) {
      const def = await this.getDefinition(dep);
      const depsCompleted = await this.allDependenciesCompleted(def.dependencies || []);
      if (depsCompleted) {
        await scheduler.schedule(def);
      }
    }
  }
}
```

## 功能清单

- [x] Cron 定时任务
- [x] 延迟任务
- [x] 指数退避重试
- [x] 死信队列
- [x] 任务依赖 DAG
- [x] 任务状态追踪
- [ ] 任务分片（MapReduce）
- [ ] 灰度发布（按流量比例调度）
