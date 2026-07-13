'use strict';

const process = require('process');


const _nativeSetTimeout = globalThis.setTimeout;
const _nativeSetInterval = globalThis.setInterval;
// 浏览器环境没有setImmediate
const _nativeSetImmediate = globalThis.setImmediate || ((fn) => _nativeSetTimeout(fn, 0));
const _nativeClearTimeout = globalThis.clearTimeout;
const _nativeClearInterval = globalThis.clearInterval;
const _nativeClearImmediate = globalThis.clearImmediate || _nativeClearTimeout;
const _nativeNextTick = process.nextTick;
const _nativeQueueMicrotask = globalThis.queueMicrotask;

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
    if (idx === -1) {
      return false;
    }
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
      if (this.compare(this.data[index], this.data[parent]) >= 0) {
        break;
      }
      [this.data[index], this.data[parent]] = [this.data[parent], this.data[index]];
      index = parent;
    }
  }

  _bubbleDown(index) {
    const len = this.data.length;

    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      if (left < len && this.compare(this.data[left], this.data[smallest]) < 0) {
        smallest = left;
      }
      if (right < len && this.compare(this.data[right], this.data[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }
      [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
      index = smallest;
    }
  }
}

class EventLoop {
  constructor() {
    // Phase Queue
    this._timers = new MinHeap((a, b) => a.triggerAt - b.triggerAt);
    this._ioCallbacks = [];
    this._immediateQueue = [];
    this._closeCallbacks = [];

    // 微队列
    this._nextTickQueue = [];
    this._microtaskQueue = [];

    // state
    this._running = false;
    this._timerId = 0;
    this._timerMap = new Map();
    this._immediateId = 0;
    this._imediateMap = new Map();
    this._idleCount = 0;
    this._maxIdleTicks = 3;

    this._stats = {
      timersFired: 0,
      immediatesFired: 0,
      ioCallbacksFired: 0,
      nextTicksFired: 0,
      microTaskFired: 0,
    }
  }

  setTimeout(callback, delay = 0, ...args) {
    if (typeof callback !== 'function') {
      throw new TypeError("Callback must be a function.");
    }
    const id = ++this._timerId;
    const timer = {
      id,
      callback,
      args,
      triggerAt: Date.now() + Math.max(0, delay);
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
    this._validateCB(callback);
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

  setImmediate(callback, ...args) {
    this._validateCB(callback);
    const id = ++this._immediateId;
    const immediate = { id, callback, args };
    this._immediateQueue.push(immediate);
    this._imediateMap.set(id, immediate);
    this._wakeUp();
    return id;
  }

  clearImmediate(id) {
    const immediate = this._imediateMap.get(id);
    if (immediate) {
      immediate.cancelled = true;
      this._imediateMap.delete(id);
    }
  }

  nextTick(callback, ...args) {
    this._validateCB(callback);
    this._nextTickQueue.push({ callback, args });
  }

  queueMicrotask(callback) {
    this._validateCB(callback);
    this._microtaskQueue.push({ callback });
  }
  
  _validateCB(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError("Callback must be a function.");
    }
  }

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
    // 让出CPU
    return new Promise((resolve) => _nativeSetTimeout(resolve, 1));
  }

  getStats() {
    return {
      ...this._stats;
    }
  }
}