# JS 执行优化

## 1. 长任务拆分

```javascript
// ❌ 阻塞主线程 500ms
function processLargeArray(data) {
  const results = [];
  for (let i = 0; i < data.length; i++) {
    results.push(heavyComputation(data[i]));
  }
  return results;
}

// ✅ 使用 Scheduler.yield（Chrome 115+）
async function processLargeArray(data) {
  const results = [];
  for (let i = 0; i < data.length; i++) {
    results.push(heavyComputation(data[i]));
    if (i % 100 === 0) {
      await scheduler.yield();  // 让出主线程
    }
  }
  return results;
}

// ✅ 使用 setTimeout（兼容方案）
function processInChunks(data, chunkSize = 100) {
  return new Promise((resolve) => {
    const results = [];
    let index = 0;

    function processChunk() {
      const end = Math.min(index + chunkSize, data.length);
      for (let i = index; i < end; i++) {
        results.push(heavyComputation(data[i]));
      }
      index = end;

      if (index < data.length) {
        setTimeout(processChunk, 0);  // 让出主线程
      } else {
        resolve(results);
      }
    }

    processChunk();
  });
}

// ✅ 使用 requestIdleCallback（非紧急任务）
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 0 && tasks.length > 0) {
    const task = tasks.shift();
    task.run();
  }
  if (tasks.length > 0) {
    requestIdleCallback(processTasks);  // 还有任务，继续
  }
});
```

## 2. Web Workers

```javascript
// worker.js
self.onmessage = (e) => {
  const { data, type } = e.data;
  const result = heavyComputation(data);
  self.postMessage({ type, result });
};

// main.js
const worker = new Worker('worker.js');

worker.postMessage({ data: largeArray, type: 'process' });

worker.onmessage = (e) => {
  const { result } = e.data;
  updateUI(result);
};
```

## 3. 事件节流与防抖

```javascript
// 节流：固定频率执行
function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// 防抖：延迟执行，期间再次触发则重置
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 使用
window.addEventListener('scroll', throttle(handleScroll, 16));
input.addEventListener('input', debounce(handleSearch, 300));
```

## 4. 避免内存泄漏

```javascript
// ❌ 忘记移除事件监听
class Component {
  constructor() {
    window.addEventListener('resize', this.handleResize);
  }
  // 没有 cleanup
}

// ✅ 正确清理
class Component {
  constructor() {
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }
  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }
}

// ❌ 闭包引用导致无法 GC
function createClosure() {
  const hugeArray = new Array(1000000);
  return () => console.log('leak');
  // hugeArray 被闭包引用，无法释放
}

// ✅ 分离引用
function createClosure() {
  const hugeArray = new Array(1000000);
  const result = doSomething(hugeArray);
  return () => result;  // 只引用 result
}
```
