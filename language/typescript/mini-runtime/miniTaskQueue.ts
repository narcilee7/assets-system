/**
 * 手写 mini task queue
 *
 * 考点：
 * - 并发控制、任务优先级、重试退避、延迟调度。
 * - 状态机（idle / running / paused）与事件通知。
 */

export interface TaskOptions {
  delay?: number;
  retries?: number;
  backoff?: number;
  priority?: number;
}

export interface TaskResult<T> {
  id: number;
  status: "ok" | "error";
  value?: T;
  error?: unknown;
}

type TaskState = "pending" | "running" | "completed";

interface InternalTask<T> {
  id: number;
  fn: () => T | Promise<T>;
  options: Required<TaskOptions>;
  resolve: (value: TaskResult<T>) => void;
  reject: (reason: unknown) => void;
  attempts: number;
  state: TaskState;
  timer?: NodeJS.Timeout;
}

const defaults: Required<TaskOptions> = {
  delay: 0,
  retries: 0,
  backoff: 0,
  priority: 0,
};

export class MiniTaskQueue {
  private tasks: InternalTask<unknown>[] = [];
  private running = 0;
  private idCounter = 0;
  private concurrency: number;
  private paused = false;

  constructor(concurrency = 1) {
    this.concurrency = Math.max(1, concurrency);
  }

  add<T>(fn: () => T | Promise<T>, options: TaskOptions = {}): Promise<TaskResult<T>> {
    return new Promise((resolve, reject) => {
      const task: InternalTask<T> = {
        id: ++this.idCounter,
        fn,
        options: { ...defaults, ...options },
        resolve: resolve as (value: TaskResult<unknown>) => void,
        reject,
        attempts: 0,
        state: "pending",
      };
      this.tasks.push(task as InternalTask<unknown>);
      this.sort();
      this.schedule();
    });
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.schedule();
  }

  setConcurrency(n: number): void {
    this.concurrency = Math.max(1, n);
    this.schedule();
  }

  private sort(): void {
    this.tasks.sort((a, b) => b.options.priority - a.options.priority);
  }

  private schedule(): void {
    if (this.paused) return;
    while (this.running < this.concurrency) {
      const task = this.tasks.find((t) => t.state === "pending");
      if (!task) break;
      void this.run(task);
    }
  }

  private async run(task: InternalTask<unknown>): Promise<void> {
    task.state = "running";
    this.running++;

    if (task.options.delay > 0) {
      await new Promise<void>((resolve) => {
        task.timer = setTimeout(resolve, task.options.delay);
      });
    }

    try {
      task.attempts++;
      const value = await task.fn();
      task.state = "completed";
      this.finish(task, { id: task.id, status: "ok", value });
    } catch (error) {
      if (task.attempts <= task.options.retries) {
        const wait = task.options.backoff * task.attempts;
        if (wait > 0) {
          await new Promise<void>((resolve) => {
            task.timer = setTimeout(resolve, wait);
          });
        }
        task.state = "pending";
        this.running--;
        this.schedule();
        return;
      }
      task.state = "completed";
      this.finish(task, { id: task.id, status: "error", error });
    }
  }

  private finish(task: InternalTask<unknown>, result: TaskResult<unknown>): void {
    this.running--;
    const idx = this.tasks.indexOf(task);
    if (idx !== -1) this.tasks.splice(idx, 1);
    task.resolve(result);
    this.schedule();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const q = new MiniTaskQueue(2);
  q.add(() => "a", { priority: 1 });
  q.add(() => "b", { priority: 2 });
  console.log("task queue created");
}
