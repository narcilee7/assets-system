# TypeScript 类型系统

---

## 模块 1：类型层级（Type Hierarchy）—— 不是继承，是偏序

### 1.1 层级全景

```
        unknown  ←—— 顶类型（Top Type）
          │
    ┌─────┴─────┐
    │           │
   any        object
    │      ┌────┼────┐
    │   Array Function 自定义对象
    │      │     │
    └──────┴─────┘
    string number boolean symbol bigint
    null undefined
    void
        │
      never  ←—— 底类型（Bottom Type）
```

### 1.2 `unknown` vs `any`：安全与自由的精确边界

```ts
// any：双向黑洞——任何类型可以赋值给 any，any 可以赋值给任何类型
let a: any = "hello";
let n: number = a; // ✅ 编译通过，运行时可能爆炸

// unknown：单向安全——任何类型可以赋值给 unknown，但 unknown 不能赋值给任何类型（除非先收窄）
let u: unknown = "hello";
let s: string = u; // ❌ 编译错误
if (typeof u === "string") {
  let s2: string = u; // ✅ 收窄后安全
}
```

**底层原理**：`any` 在类型系统中同时满足 `any extends T` 和 `T extends any`（对所有 T），这破坏了类型系统的**传递性**和**可靠性（soundness）**。`unknown` 只满足 `T extends unknown`，是**可靠的顶类型**。

**面试考点**：
> "什么时候用 `any`，什么时候用 `unknown`？"
- 普通答案：`any` 方便但危险，`unknown` 安全但需要类型守卫。
- 架构师答案：`any` 是类型系统的**逻辑矛盾点**——它让 TS 退化为 JS。`unknown` 保持了类型系统的**单调性**（monotonicity）：子类型关系是单向的，不会反转。

### 1.3 `never`：底类型的工程意义

```ts
// never 是所有类型的子类型
let x: never = (() => { throw new Error() })(); // ✅
let y: string = x; // ✅ never 可以赋值给任何类型

// 但没有任何类型（除了 never 本身）可以赋值给 never
let z: never = "hello"; // ❌
```

**工程场景 1：穷尽检查（Exhaustiveness Checking）**

```ts
type Shape = 
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number };

function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.radius ** 2;
    case "square": return s.side ** 2;
    default:
      // 如果未来新增 Shape 变体，这里会编译报错
      const _exhaustive: never = s;
      return _exhaustive;
  }
}
```

**底层原理**：`never` 是**空类型**——没有任何值的类型。在数学上，它是类型的**初始对象**（initial object）。在控制流分析中，如果代码能到达 `const _exhaustive: never = s`，说明 `s` 的类型没有被前面的分支完全消耗，编译器会报错。

**工程场景 2：过滤联合类型**

```ts
type NonNullable<T> = T extends null | undefined ? never : T;
type A = NonNullable<string | null | undefined>; // string
```

这里的 `never` 在**分布式条件类型**中被**过滤掉**——这是 TS 类型系统的核心行为：联合类型中的 `never` 会被自动移除。

---

## 模块 2：结构化类型系统（Structural Typing）—— TS 的第一性原理

### 2.1 名义类型 vs 结构化类型

| 维度 | 名义类型（Nominal） | 结构化类型（Structural） |
|------|-------------------|----------------------|
| 类型身份 | 由声明的名字决定 | 由成员结构决定 |
| 代表语言 | Java、C#、Swift、Rust | TypeScript、Go、OCaml |
| 同构异义 | 可以区分 | 无法区分 |
| 运行时成本 | 需要 RTTI（运行时类型信息） | 零成本（编译时擦除） |
| 与 JS 一致性 | 低 | 高 |

```ts
// 名义类型语言中（如 Java），这是两个完全不同的类型
interface UserId { value: string }
interface ProductId { value: string }

function getUser(id: UserId) { ... }
const pid: ProductId = { value: "123" };
getUser(pid); // TS 中：✅ 完全合法（结构相同）
```

### 2.2 为什么 TS 选择结构化？

**不是因为「更好」，而是因为「JS 就是这样运行的」。**

JS 没有类的概念（ES6 class 是语法糖），对象之间的「兼容性」从来都是看「有没有这个属性」。TS 的结构化类型是对运行时鸭子类型的静态建模。

**代价：同构异义问题**

```ts
type Meters = number;
type Seconds = number;

let distance: Meters = 100;
let time: Seconds = 10;
distance = time; // ✅ 完全合法，但语义上荒谬
```

### 2.3 Brand 类型：在结构化系统中模拟名义类型

```ts
// 技巧：利用交叉类型 + 唯一符号属性
type Brand<K, T> = T & { __brand: K };

type UserId = Brand<"UserId", string>;
type ProductId = Brand<"ProductId", string>;

function getUser(id: UserId) { ... }
const pid = "123" as ProductId;
getUser(pid); // ❌ 编译错误：__brand 不匹配
```

**底层原理**：`__brand` 属性在运行时并不存在（类型擦除），但在编译时创造了**结构差异**，从而让 TS 的类型检查器将两个同构类型识别为不同。

**面试深挖**：
> "TS 能不能实现真正的名义类型？"
- 普通答案：不能，TS 是结构化类型系统。
- 架构师答案：可以通过 **Brand 类型** 或 **私有字段（`#private`）** 模拟。`#private` 在编译后仍然是运行时私有的，因此可以创造真正的结构差异。但 Brand 类型更轻量，零运行时开销。

---

## 模块 3：方差（Variance）—— 类型系统最硬核的部分

这是区分「会用 TS」和「懂 TS」的分水岭。

### 3.1 四种方差的精确定义

给定类型构造器 `F<T>`，如果 `A extends B`（A 是 B 的子类型）：

| 方差 | 定义 | 例子 |
|------|------|------|
| **协变（Covariant）** | `F<A> extends F<B>` | 返回值位置：`() => A` 是 `() => B` 的子类型 |
| **逆变（Contravariant）** | `F<B> extends F<A>` | 参数位置：`(x: B) => void` 是 `(x: A) => void` 的子类型 |
| **双变（Bivariant）** | 同时满足协变和逆变 | TS 函数参数在 `strictFunctionTypes: false` 时 |
| **不变（Invariant）** | 既不协变也不逆变 | `Array<T>` 对 `T` 是不变的 |

### 3.2 为什么参数位置是逆变？

这是**类型安全**的数学必然。

```ts
class Animal { move() {} }
class Dog extends Animal { bark() {} }

// 假设参数位置是协变（错误假设）：
type AnimalHandler = (x: Animal) => void;
type DogHandler = (x: Dog) => void;

// 如果 DogHandler extends AnimalHandler（协变），则：
let handler: AnimalHandler = (x: Animal) => { x.move(); };
let dogHandler: DogHandler = handler; // 如果允许...

// 然后调用：
dogHandler(new Dog()); // ✅ 没问题
dogHandler(new Animal()); // ❌ 但 DogHandler 期望 Dog，传入 Animal 没有 bark()！
```

**推导**：为了让 `handler` 能安全地替换 `dogHandler`，`handler` 必须能接受**比 Dog 更宽泛**的类型——即 Animal。所以参数位置必须是**逆变**的：`(x: Animal) => void` 是 `(x: Dog) => void` 的子类型。

### 3.3 TS 中的方差实战

```ts
// 协变：返回值
type F1 = () => Dog;
type F2 = () => Animal;
let f1: F1 = () => new Dog();
let f2: F2 = f1; // ✅ Dog 可以当 Animal 用

// 逆变：参数（strictFunctionTypes: true）
type G1 = (x: Dog) => void;
type G2 = (x: Animal) => void;
let g1: G1 = (x) => { x.bark(); };
let g2: G2 = g1; // ❌ 逆变：G2 不是 G1 的子类型
let g3: G1 = g2; // ✅ G1 是 G2 的子类型（因为 Dog 更具体）
```

### 3.4 `strictFunctionTypes` 的历史包袱

在 TS 2.6 之前，函数参数默认是**双变**的：

```ts
// strictFunctionTypes: false（旧行为）
let handler: (x: Animal) => void = (x: Dog) => { x.bark(); }; // ✅ 危险地通过
```

**为什么曾经允许双变？** 因为早期 JS 的回调模式大量依赖「传入更具体的回调」：

```ts
// 事件监听：用户可能传入 (e: MouseEvent) => void 到 (e: Event) => void 的位置
element.addEventListener("click", (e: MouseEvent) => { ... });
```

这在双变下是安全的（因为 MouseEvent 是 Event 的子类型），但在严格逆变下也是安全的——因为 `addEventListener` 的参数位置是逆变的，`(e: MouseEvent) => void` 是 `(e: Event) => void` 的**子类型**。

等等，这里需要仔细推导：

- `addEventListener` 的签名是 `(type: string, listener: (e: Event) => void)`
- 你传入 `(e: MouseEvent) => void`
- 参数位置是逆变：`(e: MouseEvent) => void` 是 `(e: Event) => void` 的子类型吗？
  - 逆变定义：如果 `A extends B`，则 `(x: B) => void extends (x: A) => void`
  - `MouseEvent extends Event`，所以 `(x: Event) => void extends (x: MouseEvent) => void`
  - 即 `(e: Event) => void` 是 `(e: MouseEvent) => void` 的子类型
  - 反过来：`(e: MouseEvent) => void` 是 `(e: Event) => void` 的**父类型**
- 所以严格逆变下，你不能把父类型赋值给子类型位置！
- 但 `addEventListener` 期望的是 `(e: Event) => void`，你传入 `(e: MouseEvent) => void`——这在严格逆变下应该是**不允许的**！

但实际上 TS 允许。为什么？

因为 TS 对**方法参数**（method parameter）和**函数参数**（function parameter）做了区分！`strictFunctionTypes` 只影响函数参数，不影响方法参数。

```ts
interface Handler {
  // 方法参数：双变（兼容旧代码）
  handle(e: Event): void;
}

interface Handler2 {
  // 函数属性参数：逆变（严格）
  handle: (e: Event) => void;
}
```

**这是 TS 最大的妥协之一**：为了兼容大量使用方法的类库（如 DOM API），方法参数保持双变，只有函数类型的属性才严格逆变。

### 3.5 `readonly` 如何让数组从不变变成协变

```ts
// 普通数组：不变的
let dogs: Dog[] = [new Dog()];
let animals: Animal[] = dogs; // ✅ 协变（TS 特殊处理）
animals.push(new Animal()); // 危险！但 TS 允许，因为数组是双变的

// readonly 数组：协变的
let readonlyDogs: readonly Dog[] = [new Dog()];
let readonlyAnimals: readonly Animal[] = readonlyDogs; // ✅ 安全协变
```

**底层原理**：`readonly` 移除了**写操作**（`push`、`pop` 等），所以不再存在「通过父类型引用向子类型数组写入不兼容值」的风险。此时数组退化为纯读取容器，协变是安全的。

**面试深挖**：
> "`Array<T>` 对方差是什么关系？"
- 普通答案：`Array<T>` 是协变的。
- 架构师答案：`Array<T>` 在 TS 中实际上是**双变**的（历史遗留），这是类型系统的一个**不可靠（unsound）**点。`readonly T[]` 才是真正的协变。如果追求完全可靠，应该使用 `ReadonlyArray<T>` 或 `readonly T[]`。

---

## 模块 4：泛型系统——约束、推断与延迟

### 4.1 泛型约束的语义

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
```

`extends` 在泛型约束中不是「继承」，而是**子类型约束**：`T` 必须是 `{ length: number }` 的子类型。

### 4.2 泛型默认参数与推断

```ts
// 默认参数
type MyMap<K = string, V = unknown> = Map<K, V>;
type A = MyMap; // MyMap<string, unknown>

// 推断优先级：显式 > 上下文 > 默认
function identity<T>(x: T): T { return x; }
const n = identity(42); // T 推断为 42（字面量类型）
const s: string = identity("hello"); // T 推断为 string（上下文拓宽）
```

### 4.3 协变/逆变位置对泛型推断的影响

```ts
// 协变位置：T 从返回值推断
declare function f1<T>(): T;
const x = f1(); // T 推断为 unknown

// 逆变位置：T 从参数推断
declare function f2<T>(x: T): void;
f2("hello"); // T 推断为 "hello"（字面量）

// 双向协变/逆变位置：T 从多个位置推断，取交集或并集
declare function f3<T>(x: T): T;
const y = f3("hello"); // T 推断为 "hello"
```

---

## 模块 5：条件类型与分布式行为——类型系统的 if 语句

### 5.1 基础条件类型

```ts
type IsString<T> = T extends string ? true : false;
type A = IsString<"hello">; // true
type B = IsString<42>; // false
```

### 5.2 分布式条件类型（Distributive Conditional Types）

这是 TS 类型系统最精妙的设计之一。

```ts
type ToArray<T> = T extends any ? T[] : never;
type A = ToArray<string | number>; // string[] | number[]（分布式）
```

**分布式规则**：当 `T` 是**裸类型参数**（naked type parameter）时，条件类型会对联合类型的每个成员分别应用，然后结果再联合。

**阻止分布式的技巧**：

```ts
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type B = ToArrayNonDist<string | number>; // (string | number)[]
```

用元组包裹 `T`，`T` 不再是裸类型参数，分布式行为被抑制。

### 5.3 `infer` 的延迟推断

```ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type F = () => string;
type R = ReturnType<F>; // string
```

`infer R` 在**无法直接推断**时创建一个新的类型变量，在条件类型的「真分支」中可用。

**infer 的位置决定方差**：

```ts
// 返回值位置（协变）：infer 在协变位置
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// 参数位置（逆变）：infer 在逆变位置
type Parameters<T> = T extends (...args: infer P) => any ? P : never;
```

**面试深挖**：
> "`infer` 在协变位置和逆变位置有什么区别？"
- 普通答案：位置不同，推断的方向不同。
- 架构师答案：`infer` 在**协变位置**时，如果多个候选类型，TS 取**并集**。在**逆变位置**时，TS 取**交集**。这是 TS 类型推断的**方差敏感规则**：

```ts
// 协变位置：并集
type Foo<T> = T extends { a: infer U; b: infer U } ? U : never;
type T = Foo<{ a: string; b: number }>; // string | number

// 逆变位置：交集
type Bar<T> = T extends { a: (x: infer U) => void; b: (x: infer U) => void } ? U : never;
type T2 = Bar<{ a: (x: string) => void; b: (x: number) => void }>; // string & number（即 never）
```

---

## 模块 6：类型体操的图灵完备性

### 6.1 证明 TS 类型系统是图灵完备的

TS 类型系统可以表达：
- **条件分支**：`T extends U ? X : Y`
- **递归**：类型别名自引用（TS 3.7+ 支持有限递归）
- **状态存储**：元组作为栈、对象作为存储

因此，TS 类型系统可以模拟**图灵机**，是**图灵完备**的。

### 6.2 实战：实现一个类型安全的 DeepReadonly

```ts
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object 
    ? T[K] extends Function 
      ? T[K] 
      : DeepReadonly<T[K]> 
    : T[K];
};
```

**问题**：这个实现有什么缺陷？

1. `object` 包含数组、`Date`、`RegExp` 等——这些会被递归，但可能不应该
2. `Function` 检查不够精确
3. 没有处理 `null`（`null extends object` 为 true！）

**改进版**：

```ts
type Primitive = string | number | boolean | bigint | symbol | undefined | null;
type DeepReadonly<T> = T extends Primitive | Function
  ? T
  : T extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends Map<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends Set<infer U>
        ? ReadonlySet<DeepReadonly<U>>
        : { readonly [K in keyof T]: DeepReadonly<T[K]> };
```

### 6.3 实战：实现 UnionToIntersection

```ts
type UnionToIntersection<U> = 
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void 
    ? I 
    : never;

type A = UnionToIntersection<{ a: 1 } | { b: 2 }>; // { a: 1 } & { b: 2 }
```

**推导过程**：
1. `U extends any ? (x: U) => void : never` 对联合类型分布式展开：
   - 得到 `(x: { a: 1 }) => void | (x: { b: 2 }) => void`
2. 这个联合类型作为**函数参数**的推断目标：
   - 函数参数位置是**逆变**的
   - 逆变位置 infer 取**交集**
   - 所以 `I` 推断为 `{ a: 1 } & { b: 2 }`

这是 TS 类型体操中最经典的「利用逆变位置取交集」技巧。

---

## 模块 7：类型收窄（Type Narrowing）—— 控制流分析

### 7.1 类型守卫的三种形式

```ts
// 1. typeof / instanceof / in / 字面量比较
function f1(x: string | number) {
  if (typeof x === "string") {
    x; // string
  }
}

// 2. 自定义类型谓词（Type Predicate）
function isString(x: unknown): x is string {
  return typeof x === "string";
}

// 3. 断言函数（Assertion Function）
function assertIsString(x: unknown): asserts x is string {
  if (typeof x !== "string") throw new Error();
}
```

### 7.2 类型谓词 vs 断言函数

| 特性 | `is` 类型谓词 | `asserts` 断言函数 |
|------|-------------|-------------------|
| 返回类型 | `boolean` | `void` |
| 失败行为 | 返回 false | 抛出异常 |
| 对控制流的影响 | 条件分支收窄 | 后续代码直接收窄 |
| 使用场景 | 运行时检查 + 分支处理 | 前置校验，失败即终止 |

### 7.3 控制流分析的上限

TS 的 CFA（Control Flow Analysis）不是无限的：

```ts
function example(x: string | number) {
  if (typeof x === "string") {
    return;
  }
  x; // number ✅
}

function example2(x: string | number) {
  if (typeof x === "string") {
    setTimeout(() => {
      x; // string | number ❌ 闭包内无法收窄
    }, 0);
  }
}
```

**原因**：闭包可能在异步上下文中执行，此时 `x` 的值可能已被外部修改。TS 保守地放弃跨闭包边界的类型收窄。

---

## 一句话总结矩阵

| 概念 | 直觉 |
|------|------|
| `unknown` | 安全的任意——先检查，后使用 |
| `never` | 空类型，用于穷尽检查和过滤 |
| 结构化类型 | 看结构，不看名字 |
| Brand 类型 | 用假属性创造结构差异，模拟名义类型 |
| 协变 | 子类型可以出现在父类型位置（返回值） |
| 逆变 | 父类型可以出现在子类型位置（参数） |
| 双变 | TS 的历史包袱，方法参数默认行为 |
| 分布式条件类型 | 裸类型参数 + 联合类型 = 逐个分发 |
| `infer` | 类型系统的「解构赋值」，位置决定方差 |
| 类型谓词 | 运行时检查 + 编译时收窄的桥梁 |

---
