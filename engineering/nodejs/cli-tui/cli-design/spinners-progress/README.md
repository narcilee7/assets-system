# Spinners & Progress Bars

长耗时 CLI 操作必须提供视觉反馈，否则用户会以为程序卡死。

## 选型矩阵

| 库 | 特点 |
| --- | --- |
| Ora | 最流行、API 简洁、可定制 |
| listr2 | 任务列表 + 嵌套 spinner |
| cli-progress | 进度条专业户 |
| nanospinner | 极轻量 |

## Ora 基础用法

```ts
// spinner.ts
import ora from 'ora';

const spinner = ora('Loading data...').start();

try {
  await fetchData();
  spinner.succeed('Data loaded');
} catch (err: any) {
  spinner.fail(`Failed: ${err.message}`);
}
```

## Listr2 任务列表

```ts
// task-list.ts
import { Listr } from 'listr2';

const tasks = new Listr([
  {
    title: 'Connect to database',
    task: async (ctx, task) => {
      await connectDB();
      task.output = 'Connected to postgres://localhost:5432/app';
    },
  },
  {
    title: 'Run migrations',
    task: async (ctx, task) => {
      const migrations = await runMigrations();
      task.output = `Applied ${migrations.length} migrations`;
    },
  },
  {
    title: 'Seed data',
    task: async () => {
      await seedData();
    },
    skip: (ctx) => ctx.skipSeed && 'Skipped via --skip-seed',
  },
  {
    title: 'Verify deployment',
    task: async (ctx, task) => {
      await healthCheck();
      task.title = '✅ Deployment verified';
    },
  },
]);

await tasks.run({ skipSeed: false });
```

## 进度条

```ts
// progress.ts
import { SingleBar, Presets } from 'cli-progress';

const bar = new SingleBar(
  {
    format: '{bar} {percentage}% | {value}/{total} files | ETA: {eta}s',
    hideCursor: true,
  },
  Presets.shades_classic
);

const total = 100;
bar.start(total, 0);

for (let i = 0; i <= total; i++) {
  await processFile(i);
  bar.update(i);
}

bar.stop();
```

## 组合使用模式

```ts
// combined.ts
import ora from 'ora';
import { SingleBar } from 'cli-progress';

export async function withProgress<T>(
  label: string,
  total: number,
  fn: (update: (current: number, message?: string) => void) => Promise<T>,
): Promise<T> {
  const spinner = ora(label).start();
  const bar = new SingleBar({ format: '{bar} {percentage}% | {message}' });

  try {
    bar.start(total, 0);
    const result = await fn((current, message) => {
      bar.update(current, { message: message || '' });
    });
    bar.stop();
    spinner.succeed(label);
    return result;
  } catch (err: any) {
    bar.stop();
    spinner.fail(`${label}: ${err.message}`);
    throw err;
  }
}
```

## 最佳实践

- 并行任务用 `listr2`，串行任务用 `ora`。
- 进度条更新频率控制在 50ms 以上，避免终端闪烁。
- 错误时 spinner 变为 `fail` 并给出原因。
- CI 环境检测：无 TTY 时禁用 spinner，输出纯文本日志。
