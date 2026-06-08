# 手写长任务拆分调度器

## 1. 基础时间片调度

```javascript
// TaskScheduler.js

class TaskScheduler {
  constructor(options = {}) {
    this.frameBudget = options.frameBudget || 16;  // 每帧预算 16ms（~60fps）
    this.tasks = [];
    this.isRunning = false;
  }

  // 添加任务
  add(task, priority = 'normal') {
    const priorities = { high: 0, normal: 1, low: 2 };
    this.tasks.push({ fn: task, priority: priorities[priority] });
    this.tasks.sort((a, b) => a.priority - b.priority);
    this.schedule();
  }

  // 调度执行
  schedule() {
    if (this.isRunning) return;
    this.isRunning = true;

    requestAnimationFrame((frameStartTime) => {
      this.runTasks(frameStartTime);
    });
  }

  // 执行任务
  runTasks(frameStartTime) {
    while (this.tasks.length > 0) {
      const elapsed = performance.now() - frameStartTime;

      // 如果时间片用完，让出主线程
      if (elapsed >= this.frameBudget) {
        requestAnimationFrame((nextFrameStart) => {
          this.runTasks(nextFrameStart);
        });
        return;
      }

      const task = this.tasks.shift();
      try {
        task.fn();
      } catch (err) {
        console.error('Task error:', err);
      }
    }

    this.isRunning = false;
  }

  // 清空任务
  clear() {
    this.tasks = [];
    this.isRunning = false;
  }
}

// ============ 使用 ============

const scheduler = new TaskScheduler({ frameBudget: 12 });

// 拆分大数组处理
const largeArray = new Array(10000).fill(0).map((_, i) => i);
const results = [];

largeArray.forEach((item, index) => {
  scheduler.add(() => {
    results[index] = item * item;
  }, index < 100 ? 'high' : 'normal');  // 前 100 个高优先级
});

// 完成后处理
scheduler.add(() => {
  console.log('All done:', results.length);
}, 'low');
```

## 2. 带进度回调的调度器

```javascript
class ProgressiveScheduler {
  async process(items, processor, options = {}) {
    const { chunkSize = 100, onProgress, onComplete } = options;
    const results = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      // 处理当前块
      const chunkResults = chunk.map(processor);
      results.push(...chunkResults);

      // 报告进度
      if (onProgress) {
        onProgress({
          processed: Math.min(i + chunkSize, items.length),
          total: items.length,
          percentage: Math.round(((i + chunkSize) / items.length) * 100),
        });
      }

      // 让出主线程
      await this.yield();
    }

    if (onComplete) {
      onComplete(results);
    }

    return results;
  }

  yield() {
    return new Promise((resolve) => {
      // 优先使用 scheduler.yield（Chrome 115+）
      if (typeof scheduler !== 'undefined' && scheduler.yield) {
        scheduler.yield().then(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }
}

// ============ 使用 ============

const progressive = new ProgressiveScheduler();

await progressive.process(
  largeArray,
  (item) => heavyComputation(item),
  {
    chunkSize: 50,
    onProgress: ({ percentage }) => {
      progressBar.style.width = `${percentage}%`;
    },
    onComplete: (results) => {
      console.log('Processing complete:', results.length);
    },
  }
);
```

## 3. 基于 requestIdleCallback 的调度器

```javascript
class IdleScheduler {
  constructor(options = {}) {
    this.timeout = options.timeout || 2000;  // 最大等待时间
    this.tasks = [];
  }

  add(task) {
    this.tasks.push(task);
    this.schedule();
  }

  schedule() {
    if (this.tasks.length === 0) return;

    requestIdleCallback(
      (deadline) => {
        while (
          (deadline.timeRemaining() > 0 || deadline.didTimeout) &&
          this.tasks.length > 0
        ) {
          const task = this.tasks.shift();
          task();
        }

        // 还有任务，继续调度
        if (this.tasks.length > 0) {
          this.schedule();
        }
      },
      { timeout: this.timeout }
    );
  }
}
```
