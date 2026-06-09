# 手写任务调度器

## 目标

实现一个简化版浏览器任务调度器，支持：
1. 宏任务（setTimeout/MessageChannel）
2. 微任务（Promise/queueMicrotask）
3. 动画帧（requestAnimationFrame）
4. 空闲回调（requestIdleCallback）
5. 优先级调度

## 实现

```javascript
// task-scheduler.js

class BrowserTaskScheduler {
  constructor() {
    this.macrotaskQueue = [];
    this.microtaskQueue = [];
    this.animationCallbacks = [];
    this.idleCallbacks = [];
    this.isRunning = false;

    // 使用 MessageChannel 实现更精确的宏任务调度
    this.channel = new MessageChannel();
    this.channel.port1.onmessage = () => this._flushMacrotasks();
  }

  // ========== 任务入队 ==========

  // 宏任务
  scheduleMacrotask(callback, delay = 0) {
    if (delay > 0) {
      setTimeout(callback, delay);
    } else {
      this.macrotaskQueue.push(callback);
      this._scheduleFlush();
    }
  }

  // 微任务
  scheduleMicrotask(callback) {
    this.microtaskQueue.push(callback);
    // 微任务在当前任务结束后立即执行
    if (!this._microtaskScheduled) {
      this._microtaskScheduled = true;
      Promise.resolve().then(() => this._flushMicrotasks());
    }
  }

  // 动画帧
  scheduleAnimation(callback) {
    this.animationCallbacks.push(callback);
    if (!this._animationScheduled) {
      this._animationScheduled = true;
      requestAnimationFrame((timestamp) => this._flushAnimations(timestamp));
    }
  }

  // 空闲回调
  scheduleIdle(callback, timeout) {
    this.idleCallbacks.push({ callback, timeout });
    if (!this._idleScheduled) {
      this._idleScheduled = true;
      this._scheduleIdleFlush();
    }
  }

  // ========== 任务执行 ==========

  _scheduleFlush() {
    if (this.isRunning) return;
    this.isRunning = true;
    // 使用 MessageChannel 比 setTimeout(fn, 0) 更快
    this.channel.port2.postMessage(null);
  }

  _flushMacrotasks() {
    this.isRunning = false;

    // 执行所有待处理的宏任务
    while (this.macrotaskQueue.length > 0) {
      const task = this.macrotaskQueue.shift();
      try {
        task();
      } catch (err) {
        console.error('Macrotask error:', err);
      }

      // 每个宏任务后检查微任务
      this._flushMicrotasks();
    }
  }

  _flushMicrotasks() {
    this._microtaskScheduled = false;

    // 微任务可以递归产生新的微任务，需要循环处理
    while (this.microtaskQueue.length > 0) {
      const task = this.microtaskQueue.shift();
      try {
        task();
      } catch (err) {
        console.error('Microtask error:', err);
      }
    }
  }

  _flushAnimations(timestamp) {
    this._animationScheduled = false;
    const callbacks = this.animationCallbacks;
    this.animationCallbacks = [];

    for (const callback of callbacks) {
      try {
        callback(timestamp);
      } catch (err) {
        console.error('Animation error:', err);
      }
    }
  }

  _scheduleIdleFlush() {
    const deadline = {
      didTimeout: false,
      timeRemaining() {
        // 假设每帧 16.67ms，留 1ms 给浏览器
        return Math.max(0, 16.67 - (performance.now() - this._startTime));
      },
    };

    requestAnimationFrame(() => {
      this._startTime = performance.now();

      // 在帧的末尾执行空闲任务
      setTimeout(() => {
        this._idleScheduled = false;
        const callbacks = this.idleCallbacks;
        this.idleCallbacks = [];

        for (const { callback, timeout } of callbacks) {
          if (timeout && performance.now() - this._startTime > timeout) {
            deadline.didTimeout = true;
          }

          try {
            callback(deadline);
          } catch (err) {
            console.error('Idle callback error:', err);
          }
        }
      }, 0);
    });
  }

  // ========== 高级调度 ==========

  // 批量处理：将大任务拆分为小块
  scheduleChunked(tasks, chunkSize = 10, onProgress) {
    let index = 0;

    const processChunk = () => {
      const end = Math.min(index + chunkSize, tasks.length);

      for (; index < end; index++) {
        tasks[index]();
      }

      onProgress?.(index, tasks.length);

      if (index < tasks.length) {
        this.scheduleMacrotask(processChunk);
      }
    };

    this.scheduleMacrotask(processChunk);
  }

  // 带优先级的调度
  scheduleWithPriority(callback, priority = 'normal') {
    const priorities = {
      immediate: 0,   // 立即执行
      high: 1,        // 用户交互
      normal: 2,      // 数据更新
      low: 3,         // 日志/分析
      idle: 4,        // 预加载
    };

    const level = priorities[priority] ?? 2;

    if (level === 0) {
      callback();  // 同步执行
    } else if (level === 1) {
      this.scheduleAnimation(callback);
    } else if (level === 2) {
      this.scheduleMacrotask(callback);
    } else if (level === 3) {
      this.scheduleMacrotask(callback, 100);  // 延迟 100ms
    } else {
      this.scheduleIdle(callback, 5000);  // 空闲时执行，最多等 5s
    }
  }
}

// ========== 使用示例 ==========

const scheduler = new BrowserTaskScheduler();

// 基础任务调度
scheduler.scheduleMacrotask(() => console.log('Macro 1'));
scheduler.scheduleMicrotask(() => console.log('Micro 1'));
scheduler.scheduleMacrotask(() => console.log('Macro 2'));

// 输出顺序：
// Micro 1（微任务优先）
// Macro 1
// Macro 2

// 动画帧调度
scheduler.scheduleAnimation((timestamp) => {
  console.log('Animation frame at', timestamp);
});

// 空闲任务
scheduler.scheduleIdle((deadline) => {
  while (deadline.timeRemaining() > 0 && tasks.length > 0) {
    tasks.shift()();
  }
}, 2000);

// 批量处理大数组
const bigArray = new Array(10000).fill(0).map((_, i) => i);
scheduler.scheduleChunked(
  bigArray.map((item) => () => processItem(item)),
  100,  // 每帧处理 100 个
  (done, total) => console.log(`Progress: ${done}/${total}`)
);
```
