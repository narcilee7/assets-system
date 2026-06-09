# 事件循环

## 1. 浏览器事件循环

```
事件循环（每个渲染进程一个）：

┌─────────────────────────────────────┐
│  Call Stack（调用栈）                │
│  ── 同步代码执行                      │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Microtask Queue（微任务队列）        │
│  ── Promise.then/catch/finally       │
│  ── MutationObserver                 │
│  ── queueMicrotask()                 │
└─────────────────────────────────────┘
            ↓ 清空后
┌─────────────────────────────────────┐
│  Macrotask Queue（宏任务队列）        │
│  ── setTimeout/setInterval           │
│  ── setImmediate（Node.js）          │
│  ── I/O 操作                         │
│  ── UI 渲染事件                      │
│  ── MessageChannel                   │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Animation Callbacks                 │
│  ── requestAnimationFrame            │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Render Pipeline                     │
│  ── Style → Layout → Paint → Composite│
└─────────────────────────────────────┘
```

```javascript
// 事件循环执行顺序示例
console.log('1: sync start');

setTimeout(() => {
  console.log('2: setTimeout');
}, 0);

Promise.resolve().then(() => {
  console.log('3: Promise microtask');
});

queueMicrotask(() => {
  console.log('4: queueMicrotask');
});

requestAnimationFrame(() => {
  console.log('5: rAF');
});

console.log('6: sync end');

// 输出顺序：
// 1: sync start
// 6: sync end
// 3: Promise microtask
// 4: queueMicrotask
// 2: setTimeout
// 5: rAF
```

## 2. 微任务与宏任务

```javascript
// 微任务优先级更高，会在当前宏任务结束后立即执行

// 微任务来源：
Promise.resolve().then(callback);
Promise.reject().catch(callback);
new Promise((resolve) => resolve()).then(callback);

queueMicrotask(callback);

const observer = new MutationObserver(callback);
observer.observe(target, { childList: true });

// 宏任务来源：
setTimeout(callback, 0);
setInterval(callback, 0);

const channel = new MessageChannel();
channel.port1.onmessage = callback;
channel.port2.postMessage(null);

// UI 事件（click, scroll 等）也是宏任务
element.addEventListener('click', callback);
```

```javascript
// 经典面试题
async function async1() {
  console.log('async1 start');   // 2
  await async2();
  console.log('async1 end');     // 6（变成微任务）
}

async function async2() {
  console.log('async2');         // 3
}

console.log('script start');      // 1

setTimeout(() => {
  console.log('setTimeout');     // 8
}, 0);

async1();

new Promise((resolve) => {
  console.log('Promise1');       // 4
  resolve();
}).then(() => {
  console.log('Promise2');       // 7
});

console.log('script end');        // 5

// 输出：1 2 3 4 5 6 7 8
```

## 3. requestAnimationFrame

```javascript
// rAF 在每次重绘前执行（通常 16.67ms = 60fps）
// 特点：
// 1. 与显示器刷新率同步
// 2. 页面不可见时暂停（节能）
// 3. 回调接收时间戳参数

// ✅ 正确：用 rAF 做动画
function animate() {
  const now = performance.now();
  const progress = (now - startTime) / duration;

  element.style.transform = `translateX(${progress * 300}px)`;

  if (progress < 1) {
    requestAnimationFrame(animate);
  }
}
requestAnimationFrame(animate);

// ❌ 错误：用 setInterval 做动画
setInterval(() => {
  element.style.left = parseInt(element.style.left) + 1 + 'px';
}, 16);  // 可能不同步，且页面隐藏时继续执行

// rAF + 节流：控制更新频率
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      updateScrollPosition();
      ticking = false;
    });
    ticking = true;
  }
});
```

## 4. requestIdleCallback

```javascript
// rIC：在浏览器空闲时执行低优先级任务
// 适用于：日志上报、数据分析、非关键预加载

requestIdleCallback((deadline) => {
  // deadline.timeRemaining()：剩余空闲时间（ms）
  // deadline.didTimeout：是否超时

  while (deadline.timeRemaining() > 0 && tasks.length > 0) {
    const task = tasks.shift();
    task();
  }

  // 如果还有任务，继续注册
  if (tasks.length > 0) {
    requestIdleCallback(processTasks);
  }
}, { timeout: 2000 });  // 最多等 2 秒

// React 的 Scheduler 使用类似机制：
// 高优先级任务（用户输入）→ 立即执行
// 低优先级任务（数据更新）→ rIC / MessageChannel
```

## 5. 任务调度策略

```javascript
// 优先级队列（简化版）
const Priority = {
  IMMEDIATE: 1,    // 用户输入
  HIGH: 2,         // 动画
  NORMAL: 3,       // 数据更新
  LOW: 4,          // 日志
  IDLE: 5,         // 预加载
};

class TaskScheduler {
  constructor() {
    this.tasks = [];
    this.isRunning = false;
  }

  schedule(task, priority = Priority.NORMAL) {
    this.tasks.push({ task, priority });
    this.tasks.sort((a, b) => a.priority - b.priority);
    this._run();
  }

  _run() {
    if (this.isRunning) return;
    this.isRunning = true;

    const process = () => {
      // 先处理所有微任务
      // （实际由浏览器自动处理）

      // 处理高优先级任务
      const highPriority = this.tasks.filter((t) => t.priority <= Priority.HIGH);
      if (highPriority.length > 0) {
        requestAnimationFrame(() => {
          highPriority.forEach((t) => t.task());
          this.tasks = this.tasks.filter((t) => t.priority > Priority.HIGH);
          process();
        });
        return;
      }

      // 处理普通任务
      const task = this.tasks.shift();
      if (task) {
        task.task();
        setTimeout(process, 0);  // 让出主线程
      } else {
        this.isRunning = false;
      }
    };

    process();
  }
}
```
