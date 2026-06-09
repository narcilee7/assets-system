# 内存管理

## 1. 堆栈结构

```
Stack（栈）→ 自动管理，函数执行完毕即释放
  ├── 基本类型值（number, string, boolean, null, undefined, symbol）
  ├── 函数调用帧（返回地址、参数、局部变量）
  └── 引用类型的指针（指向 Heap 的地址）

Heap（堆）→ 垃圾回收管理
  ├── Object
  ├── Array
  ├── Function
  ├── Date, RegExp
  └── 闭包捕获的变量

内存生命周期：
  1. 分配（new / 字面量）
  2. 使用（读写）
  3. 释放（垃圾回收）
```

```javascript
// 栈 vs 堆
let a = 10;           // 栈：值 10
let b = 'hello';      // 栈：指针 → 堆中的字符串
let c = { x: 1 };     // 栈：指针 → 堆中的对象
let d = c;            // 栈：与 c 相同的指针

function foo() {
  let local = 42;     // 栈：函数帧内的局部变量
  let obj = {};       // 堆：对象；栈：指针
}
foo();  // 函数帧弹出，local 释放；obj 可能被 GC
```

## 2. V8 垃圾回收

```
V8 分代垃圾回收：

Young Generation（新生代，~1-8MB）
  ├── From Space（使用中的半区）
  ├── To Space（空闲的半区）
  └── Scavenge GC（Minor GC）
      ├── 标记存活对象
      ├── 复制到 To Space
      ├── 交换 From/To
      └── 经过多次 GC 仍存活 → 晋升老生代

Old Generation（老生代，无上限）
  ├── Mark-Sweep（标记清除）
  │   ├── Mark Phase：从根对象遍历，标记存活
  │   ├── Sweep Phase：清除未标记对象
  │   └── 产生内存碎片
  │
  ├── Mark-Compact（标记整理）
  │   ├── Mark Phase
  │   ├── Compact Phase：将存活对象移到一端
  │   └── 消除碎片
  │
  └── Incremental Marking（增量标记）
      ├── 将标记工作分片，避免长时间停顿
      ├── 三色标记：白（未访问）、灰（处理中）、黑（已处理）
      └── Write Barrier：记录引用变化
```

```javascript
// 查看内存使用情况（Chrome）
console.log('Used JS Heap:', performance.memory.usedJSHeapSize / 1048576, 'MB');
console.log('Total JS Heap:', performance.memory.totalJSHeapSize / 1048576, 'MB');
console.log('Heap Limit:', performance.memory.jsHeapSizeLimit / 1048576, 'MB');

// 强制 GC（Node.js，开发环境）
// node --expose-gc
if (global.gc) {
  global.gc();
}
```

## 3. 内存泄漏模式

```javascript
// 模式 1：全局变量
function leak1() {
  leaked = 'I am global';  // 没有 var/let/const
}

// 模式 2：闭包引用
function createLeaker() {
  const bigData = new Array(1000000).fill('x');

  return {
    getSmall() {
      return 'small';
    },
    // bigData 被闭包引用，无法释放
  };
}

// ✅ 修复：只在需要时捕获
function createFixed() {
  return {
    process(data) {
      // 不持有 bigData 的引用
      return data.map((d) => d * 2);
    },
  };
}

// 模式 3：被遗忘的定时器
function leak3() {
  const data = fetchBigData();
  setInterval(() => {
    console.log(data.timestamp);  // data 一直被引用
  }, 1000);
  // 组件卸载后定时器仍在运行
}

// ✅ 修复：清理定时器
let timer;
function safeTimer() {
  const data = fetchBigData();
  timer = setInterval(() => {
    console.log(data.timestamp);
  }, 1000);
}
function cleanup() {
  clearInterval(timer);
}

// 模式 4：DOM 引用泄漏
const elements = [];
function leak4() {
  const el = document.getElementById('temp');
  elements.push(el);  // 即使 DOM 删除，JS 引用仍在
}

// ✅ 修复：使用 WeakMap
const weakElements = new WeakMap();
function safeRef(el) {
  const data = { extra: 'info' };
  weakElements.set(el, data);  // el 被 GC 后，WeakMap 自动清理
}

// 模式 5：事件监听器泄漏
function leak5() {
  const handler = () => { /* 引用了外部数据 */ };
  document.addEventListener('click', handler);
  // 没有 removeEventListener
}

// ✅ 修复：使用 AbortController
const controller = new AbortController();
document.addEventListener('click', handler, { signal: controller.signal });
// 清理：controller.abort();
```

## 4. 内存分析工具

```javascript
// 1. Chrome DevTools Memory 面板
// - Heap Snapshot：查看对象分布
// - Allocation Timeline：记录内存分配时间线
// - Allocation Sampling：采样分析

// 2. 代码中标记分析点
function measureMemory(label) {
  if (performance.memory) {
    console.log(`[${label}] Used: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`);
  }
}

measureMemory('before');
// ... 执行操作 ...
measureMemory('after');

// 3. PerformanceObserver 监控长任务（间接反映 GC）
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.warn('Long task:', entry.duration, 'ms');
    }
  }
});
observer.observe({ entryTypes: ['longtask'] });
```
