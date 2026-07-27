# 深入执行上下文

## 什么是执行上下文

ECMASCript规范：执行上下文是用于跟踪代码运行时的评估状态的一种规范设备。任何 JS 代码在执行时，都运行在某个执行上下文中。

执行上下文是 JS 引擎在运行代码时维护的一个内部数据结构，它包含了代码运行所需的一切信息——变量、函数、this 指向、作用域链等。

## 执行上下文的三种类型

- 全局执行上下文：脚本执行的时候开始参创建，浏览器：`window`，Node.js `global`
- 函数执行上下文：函数被调用时创建，有自己的this绑定
- Eval执行上下文：`eval()`执行代码时，继承调用者的词法环境
- 模块执行上下文：ESModule加载时，模块自己的作用域

## 执行上下文：调用栈

JS 是单线程的，同一时间只能执行一个任务。执行上下文以栈（Stack）结构管理：

```plantuml
调用栈（Call Stack）—— 后进先出（LIFO）

   ┌─────────────────┐
   │  bar() 的 FEC   │  ← 当前正在执行
   │  AO: { y: 2 }   │
   │  this: window   │
   └─────────────────┘
   ┌─────────────────┐
   │  foo() 的 FEC   │
   │  AO: { x: 1 }   │
   │  this: window   │
   └─────────────────┘
   ┌─────────────────┐
   │   全局 GEC      │  ← 栈底，最先创建
   │  GO: { a: 10 }  │
   │  this: window   │
   └─────────────────┘
```

## 执行上下文的内部结构

在ECMAScript规范中，执行上下文包含三个核心组件：

```plain
执行上下文（Execution Context）
  ├─ LexicalEnvironment（词法环境）← 当前作用域的变量/函数
  ├─ VariableEnvironment（变量环境）← ES3 遗留，var 声明存储于此
  └─ ThisBinding（this 绑定）
```

### 词法环境

词法环境由环境记录（Environment Record）和可能为 null 的外部词法环境引用（Outer Lexical Environment Reference）组成。

```plantuml
Lexical Environment
  ├─ Environment Record（环境记录）
  │   ├─ Declarative Environment Record（声明式环境记录）
  │   │   └─ 存储 let/const/class/module import 等绑定
  │   └─ Object Environment Record（对象式环境记录）
  │       └─ 存储 var/global function 等绑定（关联到全局对象）
  │
  └─ Outer Lexical Environment Reference（外部引用）
      └─ 指向父级词法环境，构成作用域链
```

### 环境记录的类型

| 类型          | 存储内容                                            | 典型场景          |
| ----------- | ----------------------------------------------- | ------------- |
| **声明式环境记录** | `let`、`const`、`class`、`import`、`function`（严格模式） | 函数体、块级作用域、模块  |
| **对象式环境记录** | `var`、`function`（非严格全局）、全局对象属性                  | 全局作用域、with 语句 |

## 执行上下文的两个阶段

每一个执行上下文的生命周期分为两个阶段：

### 1:创建阶段

此时代码尚未执行，引擎做三件事：
1. 绑定 this（ThisBinding） 
2. 创建词法环境（LexicalEnvironment）
3. 创建变量环境（VariableEnvironment）

|      | VariableEnvironment   | LexicalEnvironment         |
| ---- | --------------------- | -------------------------- |
| 用途   | 存储 `var` 声明和函数声明      | 存储 `let`、`const`、`class` 等 |
| 提升行为 | 声明提升并初始化为 `undefined` | 声明提升但处于 **TDZ**（未初始化）      |
| 作用域  | 函数作用域 / 全局            | 块级作用域                      |

### 2:执行阶段

代码逐行执行，变量赋值，表达式求值。

## 变量提升的真相

### 1. `var`的提升

```js
console.log(a);  // undefined（不是 ReferenceError）
var a = 1;

// 引擎实际做的（创建阶段）：
// VariableEnvironment 中创建绑定：a = undefined
// 执行阶段：a = 1（赋值）
```

### `let`/`const`的TDZ(Temporal Dead Zone)

```js
console.log(b);  // ReferenceError: Cannot access 'b' before initialization
let b = 2;

// 引擎实际做的（创建阶段）：
// LexicalEnvironment 中创建绑定：b = <uninitialized>
// 执行阶段：b = 2（赋值）
// 在赋值前访问 → 抛出 ReferenceError
```

TDZ 的本质：
- let/const 的绑定在创建阶段已经存在，但状态是 <uninitialized>
- 访问未初始化的绑定 → ReferenceError
- TDZ 从绑定创建开始，到执行到声明语句的初始化器结束

### 函数声明 vs 函数表达式

```js
foo();  // 'function declaration'
bar();  // TypeError: bar is not a function

function foo() { console.log('function declaration'); }
var bar = function() { console.log('function expression'); };

// 创建阶段：
// VariableEnvironment:
//   foo: <function object>（函数声明整体提升）
//   bar: undefined（var 声明提升，但赋值不提升）
```

#### 函数声明提升的优先级

```js
var foo = 1;
function foo() {}
console.log(typeof foo);  // "number"

// 实际执行：
// 1. 创建阶段：函数声明 foo 先创建绑定
// 2. 创建阶段：var foo 发现已有同名绑定，跳过（不覆盖）
// 3. 执行阶段：foo = 1（赋值覆盖函数）
// 结果：foo 是 number
```

