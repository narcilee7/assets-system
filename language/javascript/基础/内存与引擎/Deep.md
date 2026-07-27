# 深入JavaScript 内存与引擎

---

## 一、V8 引擎架构全景

V8 是 Google 开发的高性能 JS 引擎，用于 Chrome 和 Node.js。其执行管线经历了多次演进：

```
JS 源码
   │
   ▼
┌─────────────┐
│   Parser    │  ← 词法分析 + 语法分析，生成 AST
│  (解析器)    │
└─────────────┘
   │
   ▼
┌─────────────┐
│  Ignition   │  ← 基线解释器，AST → 字节码（Bytecode）
│  (点火器)    │     同时收集类型反馈（Type Feedback）
└─────────────┘
   │
   ├─ 冷代码路径 ──→ 持续解释执行（字节码）
   │
   └─ 热代码路径 ──→ 优化编译
          │
          ▼
   ┌─────────────┐
   │   Maglev    │  ← 中端优化编译器（V8 v11.3+）
   │  (磁悬浮)   │     快速生成优化机器码，编译速度快
   └─────────────┘
          │
          └─ 更热 ──→
                    │
              ┌─────────────┐
              │  TurboFan   │  ← 高端优化编译器
              │  (涡轮风扇)  │     激进优化，基于类型假设生成高效机器码
              └─────────────┘
                    │
                    ▼
              机器码执行 ←─ 若类型假设失败（Deoptimization）─→ 回退到 Ignition
```

**关键组件**：

| 组件 | 职责 | 特点 |
|-----|------|------|
| **Ignition** | 解释执行字节码 | 内存占用低，启动快，收集运行时类型信息 |
| **Maglev** | 快速 JIT 编译 | 编译速度快，适合中等热度代码，平衡速度与编译开销 |
| **TurboFan** | 深度 JIT 优化 | 基于 Sea of Nodes IR，进行常量折叠、内联、逃逸分析等 |
| **Sparkplug** | 快速非优化编译（v9.1+，后被 Maglev 替代趋势）| 直接从字节码生成机器码，无 IR |

**Deoptimization（去优化）**：
TurboFan 基于**推测优化**（Speculative Optimization）生成机器码。若运行时类型与假设不符，触发去优化，回退到字节码解释执行。

```javascript
function add(x, y) {
  return x + y;
}

add(1, 2);      // Ignition 执行，收集反馈：number + number
add(3, 4);      // 热度上升，Maglev/TurboFan 编译：假设均为 number
add("a", "b");  // 类型假设失败！触发 Deoptimization，回退到 Ignition
```

---

## 二、内存模型：堆的分区结构

V8 的堆（Heap）并非单一区域，而是按对象生命周期和大小精细分区：

```
V8 Heap
├── 新生代（New Space）← 小对象、存活时间短
│   ├── From Space（半区）
│   └── To Space（半区）
│
├── 老生代（Old Space）← 大对象、存活时间长
│   ├── Old Pointer Space（含指针的对象）
│   └── Old Data Space（纯数据对象，如字符串）
│
├── 大对象空间（Large Object Space）
│   └── 大小超过页限制的对象（> 1MB），直接分配，不参与 GC 移动
│
├── 代码空间（Code Space）
│   └── JIT 编译后的机器码
│
├── 单元空间（Cell Space / Property Cell Space）
│   └── 全局变量、属性单元等
│
└── 映射空间（Map Space）
    └── Hidden Class（Map）对象
```

**新生代 vs 老生代**：

| 维度 | 新生代（New Space） | 老生代（Old Space）|
|-----|-------------------|-------------------|
| 容量 | 小（默认 1-8MB，分半区）| 大（堆总量减去新生代）|
| 对象特征 | 小对象、存活时间短 | 大对象、存活时间长 |
| GC 算法 | Scavenge（复制算法）| Mark-Sweep + Mark-Compact |
| GC 频率 | 高 | 低 |
| 停顿时间 | 短（< 1ms）| 长（需优化为增量/并发）|

---

## 三、垃圾回收算法深度解析

### 1. 新生代：Scavenge（复制算法）

```
From Space（使用中的半区）        To Space（空闲半区）
┌─────────┬─────────┐           ┌─────────┐
│  ObjA   │  ObjB   │           │  空闲   │
│（存活）  │（死亡）  │           │         │
└─────────┴─────────┘           └─────────┘

GC 触发：
1. 标记 From Space 中的存活对象（根可达性分析）
2. 将存活对象复制到 To Space，并整理（紧凑排列）
3. 清空 From Space
4. 交换 From/To 标签

结果：
From Space（原 To）              To Space（原 From）
┌─────────┬─────────┐           ┌─────────┐
│  ObjA   │  空闲   │           │  已清空  │
│（已复制） │         │           │         │
└─────────┴─────────┘           └─────────┘
```

**晋升（Promotion）**：
若对象经历两次 Scavenge 仍存活，或 To Space 使用率超过 25%，对象晋升到老生代。

**为什么分半区？**
- 复制算法只需处理存活对象，新生代中大部分对象朝生夕死，复制成本低
- 实现简单，无内存碎片，分配速度快（指针碰撞）

### 2. 老生代：Mark-Sweep + Mark-Compact

**阶段一：标记（Mark）**

```
根集合（Roots）：
  ├─ 全局对象（window/global）
  ├─ 当前执行上下文的局部变量
  ├─ 激活的闭包引用
  └─ DOM 节点引用（浏览器环境）

可达性分析：从 Roots 出发，遍历对象图，标记所有可达对象
```

**Orinoco 项目的优化标记**：
- **并行标记（Parallel Marking）**：多线程同时标记，缩短主线程停顿
- **增量标记（Incremental Marking）**：标记分步执行，与 JS 交替进行，避免长时间停顿
- **并发标记（Concurrent Marking）**：后台线程标记，主线程几乎不停顿

**阶段二：清除（Sweep）**

```
标记后：
┌─────┬─────┬─────┬─────┬─────┐
│  M  │  U  │  M  │  U  │  M  │   M=Marked（存活）U=Unmarked（死亡）
└─────┴─────┴─────┴─────┴─────┘

清除后：
┌─────┬─────┬─────┬─────┬─────┐
│  M  │ 空闲 │  M  │ 空闲 │  M  │
└─────┴─────┴─────┴─────┴─────┘

问题：产生内存碎片！
```

**阶段三：整理（Compact）— 必要时执行**

```
整理前（碎片化）：
┌─────┬─────┬─────┬─────┬─────┐
│  M  │ 空闲 │  M  │ 空闲 │  M  │
└─────┴─────┴─────┴─────┴─────┘

整理后：
┌─────┬─────┬─────┬─────┬─────┐
│  M  │  M  │  M  │ 空闲 │ 空闲 │
└─────┴─────┴─────┴─────┴─────┘
```

**整理策略**：
- V8 使用 **"空闲列表 + 增量整理"** 策略，并非每次 GC 都整理
- 当碎片化严重时，触发 Mark-Compact，将存活对象向一端移动

### 3. 写屏障（Write Barrier）

增量/并发标记的关键问题：标记过程中 JS 仍在执行，可能修改对象引用。

```javascript
// 标记阶段，objA 已被标记为黑色（处理完毕）
// JS 执行：
objA.ref = objB;  // objB 是新的白色对象（未标记）

// 若无写屏障，objB 将漏标！
```

**解决方案：写屏障（Write Barrier）**
当黑色对象引用白色对象时，将白色对象（或相关对象）重新标记为灰色，确保最终一致性。

---

## 四、隐藏类（Hidden Class）与对象布局优化

### 1. 为什么需要 Hidden Class？

JS 是动态类型语言，对象可以在运行时随意增删属性。但 V8 为了生成高效机器码，需要**预测对象的内存布局**。

**Hidden Class（V8 内部叫 Map）**：
- 每个 JS 对象在 V8 中都有一个 `Map` 指针，指向其 Hidden Class
- Hidden Class 描述了对象的**属性布局**：属性名、偏移量、类型等
- 具有相同 Hidden Class 的对象，内存布局相同，可以共享优化代码

### 2. 对象创建时的 Hidden Class 演变

```javascript
const p1 = {};           // Map0: 空对象

p1.name = 'Tom';         // Map0 → Map1: 添加属性 name @ offset 0
p1.age = 20;             // Map1 → Map2: 添加属性 age @ offset 1

const p2 = {};
p2.name = 'Jerry';       // p2 复用 Map1
p2.age = 18;             // p2 复用 Map2

// p1 和 p2 共享同一个 Hidden Class（Map2）
// 它们的内存布局完全一致：
// [ Map Ptr | name | age ]
```

**Hidden Class 链的可视化**：

```
Map0 (空对象)
  │
  ├─ 添加 name ──→ Map1
  │                   │
  │                   ├─ 添加 age ──→ Map2 (p1, p2 共享)
  │                   │
  │                   └─ 添加 job ──→ Map3
  │
  └─ 添加 age ──→ Map4 (不同顺序！与 Map1 分支不同)
                      │
                      └─ 添加 name ──→ Map5 (与 Map2 不共享)
```

### 3. 破坏 Hidden Class 共享的操作

```javascript
// 1. 属性顺序不一致
const a = {};
a.x = 1; a.y = 2;  // Map2

const b = {};
b.y = 2; b.x = 1;  // 不同的 Map！无法共享

// 2. 动态增删属性（尤其删除非最后添加的属性）
const c = {};
c.x = 1; c.y = 2;
delete c.x;        // 退化为 Dictionary Mode（字典模式），不再使用 Hidden Class

// 3. 使用计算属性名或 Symbol
const key = 'prop' + Math.random();
obj[key] = 1;      // 无法预测属性名，退化为字典模式

// 4. 对象属性数量过多（> 30+，阈值随 V8 版本变化）
```

**Dictionary Mode（字典模式）**：
- 对象使用 Hash Table 存储属性，而非线性布局
- 查找属性需要哈希计算，速度慢
- 无法享受 Hidden Class 和内联缓存优化

### 4. 最佳实践（从引擎角度）

```javascript
// ✅ 构造函数中初始化所有属性
class Point {
  constructor(x, y) {
    this.x = x;  // 始终初始化
    this.y = y;
  }
}

// ❌ 避免运行时动态添加
const p = new Point(1, 2);
p.z = 3;  // 创建新的 Hidden Class

// ✅ 属性顺序一致
const p1 = new Point(1, 2);
const p2 = new Point(3, 4);  // 共享 Hidden Class

// ❌ 避免 delete
delete p1.x;  // 退化为字典模式！

// ✅ 用 undefined 代替 delete
p1.x = undefined;  // 保持 Hidden Class，值置空
```

---

## 五、内联缓存（Inline Cache, IC）

### 1. 为什么需要 IC？

```javascript
function getX(obj) {
  return obj.x;
}

getX({ x: 1 });  // 需要查找 obj.x 在哪里
getX({ x: 2 });  // 再次查找
```

每次属性访问都需要：
1. 查 Hidden Class
2. 确定属性偏移量
3. 读取内存

IC 的思想：**缓存上次的查找结果，下次直接命中**。

### 2. IC 的状态机

```
Uninitialized（未初始化）
    │
    ▼ 首次执行
Pre-monomorphic（预热）
    │
    ▼ 第二次执行，类型一致
Monomorphic（单态）←── 90%+ 的代码停留在此状态，最优
    │
    ▼ 遇到不同类型（但属性结构相似）
Polymorphic（多态）←── 缓存 4 种类型（V8 限制）
    │
    ▼ 类型超过 4 种
Megamorphic（巨态）←── 回退到通用查找，性能下降
    │
    ▼ 更极端
Generic（通用）←── 完全无缓存
```

**代码示例**：

```javascript
function getX(obj) {
  return obj.x;
}

// 单态（Monomorphic）— 最优
getX({ x: 1, y: 2 });  // 缓存：Hidden Class A → offset 0
getX({ x: 3, y: 4 });  // 命中缓存！相同 Hidden Class，直接 offset 0

// 多态（Polymorphic）
getX({ x: 1 });        // 缓存：Hidden Class B → offset 0
getX({ a: 1, x: 2 });  // 缓存：Hidden Class C → offset 1
// 现在 IC 有两个条目，检查稍慢但仍缓存

// 巨态（Megamorphic）
getX({ x: 1 });
getX({ a: 1, x: 2 });
getX({ a: 1, b: 2, x: 3 });
getX({ a: 1, b: 2, c: 3, x: 4 });
// 类型过多，IC 溢出，回退到通用属性查找（哈希或线性搜索）
```

### 3. IC 的面试启示

```javascript
// ❌ 避免参数类型混乱（导致 Megamorphic）
function process(data) {
  return data.value;
}
process({ value: 1 });      // 对象
process([1, 2, 3]);         // 数组（不同 Hidden Class）
process(new Map());         // Map（又不同）

// ✅ 类型一致
function processObj(obj) {
  return obj.value;
}
processObj({ value: 1 });
processObj({ value: 2 });   // 单态 IC

// ❌ 避免总是访问不存在的属性（导致 Map 退化）
function check(obj) {
  return obj.nonExistent;   // 每次都找不到，可能触发字典模式
}
```

---

## 六、内存泄漏：模式与排查

### 1. 常见泄漏模式

**模式一：意外的全局变量**

```javascript
function leak() {
  leakedVar = 'I am global';  // 非严格模式下，未声明的变量成为全局属性
}
// 修复：'use strict' 或显式声明

// 另一种：this 指向全局
function LeakConstructor() {
  this.leaked = 'global';  // 若用 LeakConstructor() 而非 new，this 指向全局
}
```

**模式二：闭包引用未释放**

```javascript
function createHugeData() {
  const hugeArray = new Array(1e6).fill('x');
  
  return function() {
    console.log(hugeArray[0]);  // hugeArray 被闭包引用，无法 GC
  };
}

const fn = createHugeData();
// fn 存在 → hugeArray 存在
// 修复：fn = null; 解除引用
```

**模式三：DOM 引用未清理**

```javascript
const elements = {
  button: document.getElementById('btn')
};

// 即使从 DOM 中移除按钮，elements.button 仍引用它
document.body.removeChild(elements.button);
// 修复：elements.button = null;
```

**模式四：定时器/回调未清理**

```javascript
const data = new Array(1e6).fill('x');

setInterval(() => {
  console.log(data[0]);  // data 被闭包捕获，定时器不清除 → 永不释放
}, 1000);
// 修复：clearInterval + data = null
```

**模式五：Map/Set 的强引用累积**

```javascript
const cache = new Map();

function process(obj) {
  if (!cache.has(obj)) {
    cache.set(obj, heavyComputation(obj));  // obj 作为 key 被强引用
  }
  return cache.get(obj);
}

// 即使外部不再使用 obj，Map 仍持有引用 → 泄漏
// 修复：使用 WeakMap
const cache = new WeakMap();
```

### 2. WeakMap / WeakSet 的正确使用

```javascript
// WeakMap 的 key 必须是对象，且对 key 是弱引用
const wm = new WeakMap();

let obj = { data: 'sensitive' };
wm.set(obj, 'metadata');

obj = null;  // 不再有强引用指向 { data: 'sensitive' }
// WeakMap 中的条目会在下次 GC 时被自动清除
// 注意：WeakMap 不可枚举、无 size、无 clear
```

**WeakMap 的适用场景**：
- 私有数据存储（不污染对象属性）
- DOM 节点元数据缓存
- 对象生命周期关联数据

### 3. 内存泄漏排查工具

**Chrome DevTools**：

1. **Performance 面板**：录制内存时间线，观察 JS Heap 是否持续增长
2. **Memory 面板**：
   - **Heap Snapshot**：对比两个时间点的堆快照，查找增长对象
   - **Allocation Timeline**：记录内存分配的时间线
   - **Allocation Sampling**：采样分析分配热点

**排查步骤**：
```
1. 打开页面，执行正常操作
2. 强制 GC（点击垃圾桶图标）
3. 记录 Heap Snapshot（Snapshot 1）
4. 执行疑似泄漏的操作多次
5. 再次强制 GC
6. 记录 Heap Snapshot（Snapshot 2）
7. 对比两个快照，筛选 "Objects allocated between Snapshot 1 and Snapshot 2"
8. 分析 retainers（引用链），找到根引用
```

---

## 七、V8 的编译优化细节

### 1. 逃逸分析（Escape Analysis）

TurboFan 分析对象是否在函数外部被引用：

```javascript
function createPoint(x, y) {
  const p = { x, y };  // 对象 p
  return p.x + p.y;    // p 没有逃逸到外部，只是临时计算
}

// TurboFan 优化后：
// 1. 将 p 的属性内联为局部变量（标量替换）
// 2. 不在堆上分配 p 对象
// 优化后等价于：
function createPointOptimized(x, y) {
  return x + y;  // 无对象分配！
}
```

### 2. 常量折叠与死代码消除

```javascript
function compute() {
  const a = 1 + 2;        // 编译时折叠为 3
  const b = a * 0;        // 折叠为 0
  const c = b + 10;       // 折叠为 10
  if (false) {            // 死代码，完全消除
    console.log('never');
  }
  return c;
}
// 优化后等价于：return 10;
```

### 3. 函数内联（Inlining）

```javascript
function add(a, b) {
  return a + b;
}

function sum(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s = add(s, arr[i]);  // 内联后，消除函数调用开销
  }
  return s;
}

// TurboFan 内联后：
function sum(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s = s + arr[i];  // 直接内联 add 的逻辑
  }
  return s;
}
```

---

## 八、面试高频题

### 题 1：V8 中新生代和老生代分别用什么 GC 算法？

> 新生代使用 **Scavenge（复制算法）**，将存活对象从 From 半区复制到 To 半区，然后交换。老生代使用 **Mark-Sweep（标记清除）+ Mark-Compact（标记整理）**，增量/并发标记以减少停顿。

### 题 2：什么是 Hidden Class？如何破坏它？

> Hidden Class（Map）是 V8 描述对象内存布局的结构。相同 Hidden Class 的对象共享内存布局，利于 IC 优化。破坏方式：属性顺序不一致、使用 `delete`、动态计算属性名、属性数量过多（退化为字典模式）。

### 题 3：`delete obj.prop` 为什么影响性能？

> `delete` 操作会改变对象的 Hidden Class，若删除非最后一个添加的属性，对象可能退化为 **Dictionary Mode**（哈希表存储），失去 Hidden Class 和 IC 优化，属性访问变为哈希查找，性能大幅下降。

### 题 4：WeakMap 和 Map 的区别？为什么 WeakMap 能防内存泄漏？

> Map 的 key 是强引用，即使外部不再引用 key 对象，Map 仍持有它，阻止 GC。WeakMap 的 key 是弱引用，不阻止 GC，当 key 对象无其他强引用时，WeakMap 中的条目会被自动清理。WeakMap 不可枚举、无 size。

### 题 5：闭包为什么可能导致内存泄漏？

> 闭包通过 `[[Environment]]` 内部槽持有定义时的词法环境。若闭包长期存在（如作为全局变量、事件监听、定时器回调），它引用的外层变量也无法被 GC，即使外层函数已执行完毕。

---

## 九、性能优化速查清单

| 优化项 | 做法 |
|-------|------|
| **对象布局** | 构造函数中初始化全部属性，保持属性顺序一致 |
| **避免 delete** | 用 `obj.prop = undefined` 代替 `delete obj.prop` |
| **类型稳定** | 函数参数和变量保持类型一致，避免多态 |
| **减少对象分配** | 复用对象、使用对象池，减少 GC 压力 |
| **及时清理** | 移除事件监听、清除定时器、解除 DOM 引用 |
| **使用 WeakMap/WeakSet** | 存储对象的元数据或缓存，避免强引用累积 |
| **避免全局变量** | 使用 `'use strict'`，模块化代码 |
| **大对象处理** | 避免频繁创建大对象，考虑分片处理 |

---
