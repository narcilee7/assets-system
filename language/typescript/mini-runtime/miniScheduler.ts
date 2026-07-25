/**
 * 手写 mini scheduler
 *
 * 考点：
 * - 最小堆（优先级队列）实现定时任务调度。
 * - 支持一次性、周期性任务与取消。
 */

export type SchedulerTaskId = number;

interface ScheduledTask {
  id: SchedulerTaskId;
  fn: () => void;
  nextRun: number;
  interval?: number;
}

function heapPush<T>(heap: T[], item: T, compare: (a: T, b: T) => number): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (compare(heap[i], heap[parent]) >= 0) break;
    [heap[i], heap[parent]] = [heap[parent], heap[i]];
    i = parent;
  }
}

function heapPop<T>(heap: T[], compare: (a: T, b: T) => number): T | undefined {
  if (heap.length === 0) return undefined;
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length === 0) return top;
  heap[0] = last;
  let i = 0;
  while (true) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    let smallest = i;
    if (left < heap.length && compare(heap[left], heap[smallest]) < 0) smallest = left;
    if (right < heap.length && compare(heap[right], heap[smallest]) < 0) smallest = right;
    if (smallest === i) break;
    [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
    i = smallest;
  }
  return top;
}

export class MiniScheduler {
  private tasks: ScheduledTask[] = [];
  private idCounter = 0;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  schedule(fn: () => void, delay: number, interval?: number): SchedulerTaskId {
    const id = ++this.idCounter;
    heapPush(
      this.tasks,
      { id, fn, nextRun: Date.now() + delay, interval },
      (a, b) => a.nextRun - b.nextRun
    );
    this.start();
    return id;
  }

  cancel(id: SchedulerTaskId): boolean {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.tasks.splice(idx, 1);
    if (this.tasks.length === 0) this.stop();
    return true;
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  private tick(): void {
    if (!this.running) return;

    const now = Date.now();
    let task = this.tasks[0];

    while (task && task.nextRun <= now) {
      heapPop(this.tasks, (a, b) => a.nextRun - b.nextRun);
      try {
        task.fn();
      } catch (error) {
        // swallow errors to keep scheduler alive
      }
      if (task.interval !== undefined) {
        task.nextRun = now + task.interval;
        heapPush(this.tasks, task, (a, b) => a.nextRun - b.nextRun);
      }
      task = this.tasks[0];
    }

    if (this.tasks.length === 0) {
      this.stop();
      return;
    }

    const wait = Math.max(0, this.tasks[0].nextRun - Date.now());
    this.timer = setTimeout(() => this.tick(), wait);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const scheduler = new MiniScheduler();
  scheduler.schedule(() => console.log("tick"), 0, 1000);
  setTimeout(() => scheduler.stop(), 2500);
}
