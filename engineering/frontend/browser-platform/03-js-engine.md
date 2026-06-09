# JS 引擎

## 1. V8 架构

```
V8 引擎架构：

JavaScript Source Code
  ↓
[Scanner] → Tokens
  ↓
[Parser] → AST (抽象语法树)
  ↓
[Ignition] → Bytecode (字节码) + Feedback Vectors
  ↓  热代码（执行多次）
[TurboFan] → Optimized Machine Code (优化机器码)
  ↓  假设失效（类型变化）
[Deoptimize] → 回退到 Bytecode

内存分区：
├── Heap（堆）
│   ├── Young Generation（新生代）
│   │   ├── Nursery（From Space）
│   │   └── Intermediate（To Space）
│   └── Old Generation（老生代）
│       ├── Old Pointer Space
│       ├── Old Data Space
│       ├── Code Space
│       ├── Map Space
│       └── Large Object Space
│
├── Stack（栈）
│   └── 函数调用帧
│
└── WASM Memory（WebAssembly 内存）
```

## 2. 编译管道

```javascript
// Ignition（解释器）：快速启动，但执行慢
// TurboFan（优化编译器）：慢启动，但执行快

function add(a, b) {
  return a + b;
}

// 第 1 次执行：Ignition 字节码
// add 函数被解释执行

// 第 2-10 次：收集类型反馈
// Feedback Vector 记录：a 是 number, b 是 number

// 第 10+ 次：TurboFan 优化编译
// 生成优化代码，假设 a 和 b 都是 number
// 如果假设成立 → 极速执行
// 如果假设失败 → Deoptimize（回退）

// 触发 Deoptimize 的情况：
add(1, 2);     // ✓ number + number
add('a', 'b'); // ✗ string + string → Deoptimize!
add({}, []);   // ✗ object + array → Deoptimize!
```

## 3. 隐藏类（Hidden Class）

```javascript
// V8 使用隐藏类优化属性访问

// 创建对象
const p1 = { x: 1, y: 2 };
// V8 创建 HiddenClass A：{ x: offset0, y: offset1 }

const p2 = { x: 3, y: 4 };
// p2 复用 HiddenClass A（属性顺序和类型相同）

// ⚠️ 破坏隐藏类的方法：

// 1. 属性顺序不同
const p3 = { y: 5, x: 6 };  // 新的 HiddenClass B

// 2. 动态添加属性
const p4 = { x: 7 };        // HiddenClass A
p4.y = 8;                    // 转为 HiddenClass C（ transitioned）

// 3. 使用 delete
const p5 = { x: 9, y: 10 };
delete p5.y;                 // 转为字典模式（慢）

// ✅ 优化写法
class Point {
  constructor(x, y) {
    this.x = x;  // 固定顺序初始化
    this.y = y;
  }
}

// 或对象池
function createPoint(x, y) {
  return { x, y };  // 始终相同形状
}
```

## 4. 内联缓存（Inline Cache）

```javascript
// IC 优化属性访问和函数调用

function getX(obj) {
  return obj.x;
}

// 单态 IC（Monomorphic）：只见过一种形状 → 最快
getX({ x: 1 });  // IC: 检查 hidden class → 直接读取 offset
getX({ x: 2 });  // 复用同一 IC

// 多态 IC（Polymorphic）：见过 2-4 种形状 → 稍慢
getX({ x: 1 });
getX({ x: 2, y: 3 });  // 新 hidden class
// IC 链：检查 class A → 检查 class B → ...

// 超态 IC（Megamorphic）：见过 >4 种形状 → 最慢（退化到字典查找）
getX({ x: 1 });
getX({ x: 2, y: 3 });
getX({ x: 4, z: 5 });
getX({ x: 6, a: 7 });
getX({ x: 8, b: 9 });  // 超态！

// ✅ 保持单态的写法
function processItems(items) {
  // 所有 item 有相同结构
  for (const item of items) {
    console.log(item.id, item.name);  // 单态 IC
  }
}

// ❌ 避免超态
function processMixed(items) {
  for (const item of items) {
    console.log(item.id);  // 如果 items 包含多种对象形状 → 超态
  }
}
```

## 5. 性能优化实践

```javascript
// 1. 数组优化：使用连续数组（Packed Array）
const packed = [1, 2, 3];        // ✓ Packed SMI Elements（最快）
const holey = [1, , 3];          // ✗ Holey Elements（慢）
const mixed = [1, 'a', {}];      // ✗ Packed Mixed Elements（较慢）

// 2. 避免 arguments 对象
function slow() {
  console.log(arguments);  // 创建 Arguments 对象
}

function fast(...args) {
  console.log(args);       // 使用 Rest 参数 → 真实数组
}

// 3. 避免 with/eval
// with 和 eval 会使整个作用域变为动态，无法优化

// 4. 函数内联（Inlining）
function add(a, b) { return a + b; }
function calc() {
  return add(1, 2) + add(3, 4);  // TurboFan 可能内联 add
}

// 5. 使用 const/let（比 var 更容易优化）
// const → 不可重新赋值 → 更多优化机会

// 6. 避免 try-catch 放在热路径
// try-catch 会阻止函数内联和某些优化
function hotPath() {
  try {
    // 热代码 → 放在单独的函数中
    return doWork();
  } catch (e) {
    handleError(e);
  }
}

function doWork() {
  // 可以被优化的热代码
}
```
