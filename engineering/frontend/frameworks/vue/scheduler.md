# Vue 调度器

## 1. Job Queue

Vue 的更新不是同步的，而是将 effect 包装为 **job**，放入队列中异步批量执行。

```javascript
const queue = [];
let isFlushing = false;
let isFlushPending = false;
const resolvedPromise = Promise.resolve();

// 将 job 加入队列
function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job);
    queueFlush();
  }
}

// 触发异步刷新
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    resolvedPromise.then(flushJobs);  // 微任务调度
  }
}

// 执行队列中的所有 job
function flushJobs() {
  isFlushPending = false;
  isFlushing = true;

  // 按 id 排序（父组件先于子组件）
  queue.sort((a, b) => a.id - b.id);

  try {
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      job();
    }
  } finally {
    isFlushing = false;
    queue.length = 0;
  }
}
```

**为什么使用微任务？**
- 同一事件循环中的多次 state 变更，只会触发一次渲染
- 微任务在当前宏任务结束后立即执行，比 setTimeout 更快

## 2. Watch 与 WatchEffect

### Watch

```javascript
const count = ref(0);

watch(count, (newVal, oldVal) => {
  console.log('count changed:', oldVal, '->', newVal);
});

// 批量更新只触发一次 watch
count.value = 1;
count.value = 2;
count.value = 3;
// 最终只输出: count changed: 0 -> 3
```

### WatchEffect

```javascript
const count = ref(0);
const doubled = computed(() => count.value * 2);

watchEffect(() => {
  console.log(count.value, doubled.value);
});

// 自动追踪依赖：count 和 doubled 都被访问了
count.value = 1;
// 输出: 1 2
```

| 特性 | watch | watchEffect |
|------|-------|-------------|
| 依赖追踪 | 显式指定 source | 自动追踪函数内访问的响应式数据 |
| 执行时机 | 值变化后 | 立即执行 + 值变化后 |
| 旧值 | 可以获取 | 无法获取 |
| 适用场景 | 特定值变化后的副作用 | 需要自动追踪多个依赖的副作用 |

## 3. Flush Timing

```javascript
watch(source, callback, {
  flush: 'pre'    // 默认：组件更新前执行
});

watch(source, callback, {
  flush: 'post'   // 组件更新后执行（DOM 已更新）
});

watch(source, callback, {
  flush: 'sync'   // 同步执行（每次变化立即执行）
});
```

```javascript
// flush: 'post' 的实现
function queuePostFlushCb(cb) {
  // 在所有组件更新完成后执行
  postFlushCbs.push(cb);
}

function flushJobs() {
  // 1. 执行组件更新
  for (const job of queue) {
    job();
  }

  // 2. 执行 post flush callbacks
  for (const cb of postFlushCbs) {
    cb();
  }
  postFlushCbs.length = 0;
}
```

## 4. nextTick

```javascript
function nextTick(fn) {
  return fn ? resolvedPromise.then(fn) : resolvedPromise;
}

// 使用
const count = ref(0);
count.value++;

nextTick(() => {
  // DOM 已更新
  console.log(document.getElementById('counter').textContent);  // 1
});
```
