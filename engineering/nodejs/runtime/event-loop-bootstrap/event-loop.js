/**
 * 自举 Node.js Event Loop 实现
 * 
 * 这是一个从零实现的简化版 libuv event loop，不依赖 Node.js 内置的
 * setTimeout/setImmediate/nextTick/queueMicrotask，而是用自己的队列、
 * phase 调度、drain 规则来驱动异步执行。
 * 
 * 核心设计：
 * - 5 个 Phase：timers → pending I/O → poll/check → close callbacks
 * - 3 个微队列：nextTickQueue（伪微任务）→ microtaskQueue（Promise.then）
 * - 每个回调执行后 drain nextTick + microtask
 * - 使用最小堆管理 timers，O(log n) 取到期任务
 */

'use strict';

// =============================================================================
// 0. 保存原生 API（用于底层唤醒和兜底）
// =============================================================================
const _nativeSetTimeout = global.setTimeout;
const _nativeSetInterval = global.setInterval;
const _nativeSetImmediate = global.setImmediate || ((fn) => _nativeSetTimeout(fn, 0));
const _nativeClearTimeout = global.clearTimeout;
const _nativeClearInterval = global.clearInterval;
const _nativeClearImmediate = global.clearImmediate || _nativeClearTimeout;
const _nativeNextTick = process.nextTick;
const _nativeQueueMicrotask = global.queueMicrotask;

// =============================================================================
// 1. 最小堆（Binary Min-Heap）
// =============================================================================
class MinHeap {
  constructor(compare = (a, b) => a - b) {
    this.data = [];
    this.compare = compare;
  }

  add(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  peek() {
    return this.data[0];
  }

  pop() {
    if (this.data.length === 0) return undefined;
    if (this.data.length === 1) return this.data.pop();
    const root = this.data[0];
    this.data[0] = this.data.pop();
    this._bubbleDown(0);
    return root;
  }

  remove(predicate) {
    const idx = this.data.findIndex(predicate);
    if (idx === -1) return false;
    if (idx === this.data.length - 1) {
      this.data.pop();
    } else {
      this.data[idx] = this.data.pop();
      this._bubbleUp(idx);
      this._bubbleDown(idx);
    }
    return true;
  }

  get size() {
    return this.data.length;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.data[index], this.data[parent]) >= 0) break;
      [this.data[index], this.data[parent]] = [this.data[parent], this.data[index]];
      index = parent;
    }
  }

  _bubbleDown(index) {
    const len = this.data.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < len && this.compare(this.data[left], this.data[smallest]) < 0) smallest = left;
      if (right < len && this.compare(this.data[right], this.data[smallest]) < 0) smallest = right;
      if (smallest === index) break;
      [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
      index = smallest;
    }
  }
}

// =============================================================================
// 2. 自举 Event Loop
// =============================================================================
class EventLoop {
  constructor() {
    // Phase 队列
    this._timers = new MinHeap((a, b) => a.triggerAt - b.triggerAt);
    this._ioCallbacks = [];
    this._immediateQueue = [];
    this._closeCallbacks = [];

    // 微队列
    this._nextTickQueue = [];
    this._microtaskQueue = [];

    // 状态
    this._running = false;
    this._timerId = 0;
    this._timerMap = new Map();
    this._immediateId = 0;
    this._immediateMap = new Map();
    this._idleCount = 0;
    this._maxIdleTicks = 3;

    // 统计
    this._stats = {
      timersFired: 0,
      immediatesFired: 0,
      ioCallbacksFired: 0,
      nextTicksFired: 0,
      microtasksFired: 0,
    };
  }

  // ===========================================================================
  // 2.1 公共 API：Timers
  // ===========================================================================
  setTimeout(callback, delay = 0, ...args) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    const id = ++this._timerId;
    const timer = {
      id,
      callback,
      args,
      triggerAt: Date.now() + Math.max(0, delay),
      recurring: false,
      interval: 0,
      cancelled: false,
    };
    this._timers.add(timer);
    this._timerMap.set(id, timer);
    this._wakeUp();
    return id;
  }

  setInterval(callback, interval = 0, ...args) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    const id = ++this._timerId;
    const timer = {
      id,
      callback,
      args,
      triggerAt: Date.now() + Math.max(0, interval),
      recurring: true,
      interval: Math.max(0, interval),
      cancelled: false,
    };
    this._timers.add(timer);
    this._timerMap.set(id, timer);
    this._wakeUp();
    return id;
  }

  clearTimeout(id) {
    const timer = this._timerMap.get(id);
    if (timer) {
      timer.cancelled = true;
      this._timerMap.delete(id);
    }
  }

  clearInterval(id) {
    this.clearTimeout(id);
  }

  // ===========================================================================
  // 2.2 公共 API：Immediate
  // ===========================================================================
  setImmediate(callback, ...args) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    const id = ++this._immediateId;
    const immediate = { id, callback, args };
    this._immediateQueue.push(immediate);
    this._immediateMap.set(id, immediate);
    this._wakeUp();
    return id;
  }

  clearImmediate(id) {
    const immediate = this._immediateMap.get(id);
    if (immediate) {
      immediate.cancelled = true;
      this._immediateMap.delete(id);
    }
  }

  // ===========================================================================
  // 2.3 公共 API：nextTick（伪微任务）
  // ===========================================================================
  nextTick(callback, ...args) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    this._nextTickQueue.push({ callback, args });
  }

  // ===========================================================================
  // 2.4 公共 API：queueMicrotask（真微任务）
  // ===========================================================================
  queueMicrotask(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    this._microtaskQueue.push({ callback });
  }

  // ===========================================================================
  // 2.5 公共 API：模拟 I/O
  // ===========================================================================
  simulateIO(callback, ...args) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    this._ioCallbacks.push({ callback, args });
    this._wakeUp();
  }

  // ===========================================================================
  // 2.6 核心驱动循环
  // ===========================================================================
  async run(options = {}) {
    const { maxTicks = Infinity, debug = false } = options;
    this._running = true;
    let tick = 0;

    if (debug) console.log('[EventLoop] Started');

    while (this._running && tick < maxTicks) {
      tick++;
      if (debug) console.log(`\n[EventLoop] ===== Tick ${tick} =====`);

      // Phase 1: timers
      this._runTimers(debug);

      // Phase 2: pending I/O callbacks
      this._runIOCallbacks(debug);

      // Phase 3: poll + check (immediates)
      this._runImmediates(debug);

      // Phase 4: close callbacks
      this._runCloseCallbacks(debug);

      // Phase 5: 最终 drain（防止遗漏）
      this._drainNextTickAndMicrotask(debug);

      // 检查是否应该继续
      if (!this._hasWork()) {
        this._idleCount++;
        if (debug) console.log(`[EventLoop] Idle tick ${this._idleCount}`);
        if (this._idleCount >= this._maxIdleTicks) {
          if (debug) console.log('[EventLoop] Max idle reached, exiting');
          this._running = false;
        } else {
          // 让出 CPU，等待原生事件循环唤醒
          await this._yieldToNative();
        }
      } else {
        this._idleCount = 0;
      }
    }

    if (debug) {
      console.log('\n[EventLoop] ===== Stats =====');
      console.log(this._stats);
    }

    return this._stats;
  }

  stop() {
    this._running = false;
  }

  // ===========================================================================
  // 2.7 Phase 实现
  // ===========================================================================
  _runTimers(debug) {
    const now = Date.now();
    let fired = 0;
    while (this._timers.size > 0) {
      const timer = this._timers.peek();
      if (timer.cancelled) {
        this._timers.pop();
        continue;
      }
      if (timer.triggerAt > now) break;

      this._timers.pop();
      this._timerMap.delete(timer.id);
      fired++;

      if (debug) console.log(`[Timers] Firing timer #${timer.id}`);
      timer.callback(...timer.args);
      this._stats.timersFired++;

      // 每个回调后 drain nextTick + microtask
      this._drainNextTickAndMicrotask(debug);

      // 循环任务重新入队
      if (timer.recurring && !timer.cancelled) {
        timer.triggerAt = Date.now() + timer.interval;
        this._timers.add(timer);
        this._timerMap.set(timer.id, timer);
      }
    }
    if (debug && fired) console.log(`[Timers] Fired ${fired} timer(s)`);
  }

  _runIOCallbacks(debug) {
    let fired = 0;
    while (this._ioCallbacks.length > 0) {
      const { callback, args } = this._ioCallbacks.shift();
      fired++;
      if (debug) console.log(`[I/O] Firing callback #${fired}`);
      callback(...args);
      this._stats.ioCallbacksFired++;
      this._drainNextTickAndMicrotask(debug);
    }
    if (debug && fired) console.log(`[I/O] Fired ${fired} callback(s)`);
  }

  _runImmediates(debug) {
    let fired = 0;
    while (this._immediateQueue.length > 0) {
      const immediate = this._immediateQueue.shift();
      if (immediate.cancelled) continue;
      this._immediateMap.delete(immediate.id);
      fired++;
      if (debug) console.log(`[Immediate] Firing #${immediate.id}`);
      immediate.callback(...immediate.args);
      this._stats.immediatesFired++;
      this._drainNextTickAndMicrotask(debug);
    }
    if (debug && fired) console.log(`[Immediate] Fired ${fired} immediate(s)`);
  }

  _runCloseCallbacks(debug) {
    let fired = 0;
    while (this._closeCallbacks.length > 0) {
      const { callback, args } = this._closeCallbacks.shift();
      fired++;
      if (debug) console.log(`[Close] Firing callback #${fired}`);
      callback(...args);
      this._drainNextTickAndMicrotask(debug);
    }
    if (debug && fired) console.log(`[Close] Fired ${fired} callback(s)`);
  }

  // ===========================================================================
  // 2.8 Drain 规则（核心）
  // ===========================================================================
  _drainNextTickAndMicrotask(debug) {
    // Node.js 规则：
    // 1. 先 drain nextTickQueue（递归，因为 nextTick 里可能再注册 nextTick）
    // 2. 再 drain microtaskQueue（递归，因为 Promise.then 里可能再注册 Promise.then）
    // 3. 如果 nextTick 在 drain microtask 期间被注册，先执行新 nextTick，再回来 drain microtask

    let hasWork = true;
    while (hasWork) {
      hasWork = false;

      // Drain nextTick
      while (this._nextTickQueue.length > 0) {
        const { callback, args } = this._nextTickQueue.shift();
        if (debug) console.log(`[nextTick] Firing`);
        callback(...args);
        this._stats.nextTicksFired++;
        hasWork = true;
        // 每个 nextTick 后 drain microtask
        this._drainMicrotasks(debug);
      }

      // Drain microtasks
      if (this._drainMicrotasks(debug)) {
        hasWork = true;
      }
    }
  }

  _drainMicrotasks(debug) {
    let fired = 0;
    while (this._microtaskQueue.length > 0) {
      const { callback } = this._microtaskQueue.shift();
      if (debug) console.log(`[Microtask] Firing`);
      callback();
      this._stats.microtasksFired++;
      fired++;
    }
    return fired > 0;
  }

  // ===========================================================================
  // 2.9 辅助方法
  // ===========================================================================
  _hasWork() {
    return (
      this._timers.size > 0 ||
      this._nextTickQueue.length > 0 ||
      this._microtaskQueue.length > 0 ||
      this._immediateQueue.length > 0 ||
      this._ioCallbacks.length > 0 ||
      this._closeCallbacks.length > 0
    );
  }

  _wakeUp() {
    this._idleCount = 0;
  }

  _yieldToNative() {
    // 使用原生 Promise 让出 CPU，允许外部 I/O 事件进入
    return new Promise((resolve) => _nativeSetTimeout(resolve, 1));
  }

  getStats() {
    return { ...this._stats };
  }
}

// =============================================================================
// 3. 全局替换与启动
// =============================================================================
let __eventLoopInstance = null;

function bootstrapEventLoop(options = {}) {
  if (__eventLoopInstance) return __eventLoopInstance;

  const loop = new EventLoop();
  __eventLoopInstance = loop;

  // 替换全局 API
  global.setTimeout = (cb, delay, ...args) => loop.setTimeout(cb, delay, ...args);
  global.setInterval = (cb, interval, ...args) => loop.setInterval(cb, interval, ...args);
  global.setImmediate = (cb, ...args) => loop.setImmediate(cb, ...args);
  global.clearTimeout = (id) => loop.clearTimeout(id);
  global.clearInterval = (id) => loop.clearInterval(id);
  global.clearImmediate = (id) => loop.clearImmediate(id);
  process.nextTick = (cb, ...args) => loop.nextTick(cb, ...args);
  global.queueMicrotask = (cb) => loop.queueMicrotask(cb);

  // 拦截 Promise.prototype.then 以重定向到我们的 microtask queue
  // 注意：这是一个教学级别的拦截，不保证覆盖所有边缘情况
  const NativePromise = global.Promise;
  const nativeThen = NativePromise.prototype.then;
  NativePromise.prototype.then = function(onFulfilled, onRejected) {
    return nativeThen.call(
      this,
      (value) => {
        if (typeof onFulfilled === 'function') {
          loop.queueMicrotask(() => {
            try {
              onFulfilled(value);
            } catch (err) {
              // unhandled rejection 处理省略
            }
          });
        }
        return value;
      },
      (reason) => {
        if (typeof onRejected === 'function') {
          loop.queueMicrotask(() => {
            try {
              onRejected(reason);
            } catch (err) {
              // unhandled rejection 处理省略
            }
          });
        }
        throw reason;
      }
    );
  };

  // 启动循环（在下一个原生 tick 启动，确保同步代码先执行）
  _nativeSetTimeout(() => {
    loop.run(options);
  }, 0);

  return loop;
}

function simulateIO(callback, ...args) {
  if (!__eventLoopInstance) {
    throw new Error('EventLoop not bootstrapped. Call bootstrapEventLoop() first.');
  }
  __eventLoopInstance.simulateIO(callback, ...args);
}

// =============================================================================
// 4. 导出
// =============================================================================
module.exports = {
  EventLoop,
  MinHeap,
  bootstrapEventLoop,
  simulateIO,
};
