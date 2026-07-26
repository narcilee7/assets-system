# 精通JavaScript数据类型

## 完整的JS版图

ECMAScript规范中的类型分层：

```plain
语言类型（Language Types）—— JS 代码可操作
  ├─ 原始类型（Primitive）
  │   ├─ Undefined
  │   ├─ Null
  │   ├─ Boolean
  │   ├─ String
  │   ├─ Symbol
  │   ├─ Number
  │   └─ BigInt（ES2020）
  │
  └─ 对象类型（Object）
      ├─ 普通对象（Ordinary Object）—— {}、new Object()
      ├─  exotic 对象
      │   ├─ Array
      │   ├─ Function（callable object）
      │   ├─ Date
      │   ├─ RegExp
      │   ├─ Map / Set / WeakMap / WeakSet
      │   ├─ Promise
      │   ├─ Proxy
      │   └─ ...
      └─ 标准对象的原型链终点：Object.prototype

规范类型（Specification Types）—— 引擎内部使用
  ├─ Reference（引用，用于解析标识符）
  ├─ List（参数列表等）
  ├─ Completion Record（break/continue/return/throw 的抽象）
  ├─ Property Descriptor（属性描述符）
  ├─ Lexical Environment / Environment Record（作用域）
  └─ Data Block（SharedArrayBuffer 的内存块）
```

## 原始类型的底层机制

### 内存模型：Stack VS Heap的简化与真相

#### V8引擎

- V8 的堆分为：新生代（Young Generation：Scavenge GC）和老生代（Old Generation：Mark-Sweep GC） 
- 小整数（Smi）：范围 -2^31 到 2^31-1（32 位系统）或 -2^31 到 2^31-1（64 位早期），直接以** tagged pointer** 形式嵌入指针位，不分配堆内存
- 堆 number（HeapNumber）：超出 Smi 范围或浮点数，在堆上分配 64 位 IEEE 754 值
- 字符串：短字符串可能内联（cons string、slice string 等优化），长字符串堆分配
- Symbol：全局 Symbol 表维护，描述字符串存堆


## Number

位布局 (64bit)

```plain
1 bit   符号位（Sign）
11 bit  指数位（Exponent），偏移量 1023
52 bit  尾数位（Mantissa/Significand）
```

## String

```js
"𠮷".length;           // 2（不是 1！）
"𠮷" === "\uD842\uDFB7";  // true（代理对 Surrogate Pair）

// 码点（Code Point）vs 码元（Code Unit）
"𠮷".codePointAt(0);   // 134071（正确码点）
"𠮷".charCodeAt(0);    // 55362（高位代理）

// 遍历 Unicode 字符的正确方式
const str = "𠮷a";
[...str].length;       // 2（展开运算符按码点迭代）
Array.from(str).length; // 2
for (const char of str) { /* 按码点迭代 */ }

// 字符串驻留（Interning）—— 引擎优化
const s1 = "hello";
const s2 = "hello";
// V8 可能对相同字面量做驻留，s1 和 s2 可能指向同一内存
// 但规范不保证，不要依赖
```

### 为什么 String.prototype 上的方法不改变原字符串？

因为字符串是原始类型、不可变的。所有"修改"方法（slice、replace、toUpperCase）都返回新字符串。

## Symbol 唯一性与元编程

```js
const sym1 = Symbol("desc")
const sym2 = Symbol("desc")

sym1 === sym2 // false

const sym3 = Symbol.for("key");  // 全局注册表
const sym4 = Symbol.for("key");
sym3 === sym4;                   // true

Symbol.keyFor(sym3);             // "key"
Symbol.keyFor(sym1);             // undefined（非全局 Symbol）
```

## Undefined == Null 设计债务

- Undefined：没有初始化、变量声明但是没有赋值，对象无该属性，typeof undefined === 'undefined', undefined == null -> true, undefined === null -> false
- Null: 空值，手动赋予 `obj = null`，`typeof null === 'object'`

## 引用类型的浅层机制

### 对象的本质

ECMAScript规范中，对象是属性的集合，每个属性是Key+Value+Attribute的符合结构

#### Property Descriptor

```js
const obj = {}

Object.defineProperty(obj, "key", {
    value: 1,
    writable: false,
    enumerable: false,
    configurable: flase
})

Object.defineProperty(obj, "fullName", {
    get() { return this.first + " " + this.lfase },
    set(val) { [this.first, this.last] = val.split("") },
    enumerable: true,
    configurable: true,
})
```

### 包装对象(自动装箱)

原始类型在访问属性的时候，引擎会临时创建对应的包装对象

```js
const s = "hello"
s.toUpperCase() // String(s).toUpperCase()

s.attr = 1
console.log(s.attr) // undefined tmp obj has been destoryed
```

#### 为啥Symbol和Bigint禁止new

它们的包装对象没有实际用途，且 new Symbol() 会产生语义混乱（Symbol 强调唯一性，new 创建的对象可被引用追踪，破坏设计意图）。

## 类型检测的完整方法论

### typeof 

```js
typeof undefined; // "undefined"
typeof null; // "object"
typeof true // "boolean"
typeof 42 // "number"
typeof "s" // "string"
typeof Symbol() // "symbol"
typeof {} // "object"
typeof [] // "object"
typeof function(){} // "function"
typeof new Date() // "object"
```

### instance of 

```js
[] instanceof Array;       // true
[] instanceof Object;      // true（原型链上有 Object.prototype）
function(){} instanceof Function;  // true

// 边界：跨 iframe / 不同全局环境
const iframe = document.createElement("iframe");
document.body.appendChild(iframe);
const iframeArray = iframe.contentWindow.Array;
console.log([] instanceof iframeArray);  // false！
// 不同全局环境的 Array 构造器不是同一个引用
```

### `Object.prototype.toString.call`最可靠的判断


## 类型转换

### ToPrimitive

1. 若对象有`Symbol.toPrimitive`方法，调用它，传入`hint`
2. 否则：根据`hint`:
   - `hint === "string"`：先`toString()` 再 `valueOf()`
   - hint === "number" 或 "default"：先 valueOf()，再 toString()
3. 若某步返回原始值，返回该值，否则抛TypeError

### ToNumber的完整规则

| 输入          | 结果                                |
| ----------- | --------------------------------- |
| `undefined` | `NaN`                             |
| `null`      | `0`                               |
| `true`      | `1`                               |
| `false`     | `0`                               |
| `""`（空字符串）  | `0`                               |
| `" 123 "`   | `123`（自动 trim）                    |
| `"123abc"`  | `NaN`                             |
| `Symbol`    | **TypeError**                     |
| `BigInt`    | **TypeError**（不能与 Number 混用）      |
| 对象          | 先 `ToPrimitive(obj, "number")`，再转 |

### `==`抽象相等比较算法

比较 x == y 的步骤（简化版）：
类型相同 → 严格比较（===）
x 是 null 且 y 是 undefined（或反过来）→ true
x 是 Number，y 是 String → y 转 Number
x 是 String，y 是 Number → x 转 Number
x 是 Boolean → x 转 Number
y 是 Boolean → y 转 Number
x 是 String/Number/Symbol/BigInt，y 是 Object → y 转原始值（ToPrimitive）
x 是 Object，y 是 String/Number/Symbol/BigInt → x 转原始值

## 深拷贝

### JSON方法的6大致命缺陷

````js
const obj = {
  a: undefined,           // 1. 丢失
  b: function() {},       // 2. 丢失
  c: Symbol("sym"),      // 3. 丢失
  d: NaN,                // 4. 变成 null
  e: Infinity,           // 5. 变成 null
  f: new Date(),         // 6. 变成 ISO 字符串，丢失 Date 对象
  g: /abc/g,             // 7. 变成空对象 {}
  h: new Map([[1, 2]]),  // 8. 变成空对象 {}
  i: new Set([1, 2, 3]), // 9. 变成空对象 {}
  j: { self: null }      // 10. 循环引用 → 报错
};
obj.j.self = obj;

JSON.parse(JSON.stringify(obj));
// { d: null, e: null, f: "2026-07-25T...", g: {}, h: {}, i: {}, j: { self: { self: {...} } } }
// 循环引用直接抛 TypeError: Converting circular structure to JSON
````
