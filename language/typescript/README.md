# TypeScript 全栈体系

这一资产覆盖 TypeScript 从**语言设计哲学**到**编译器底层**，从**类型理论**到**工程实践**的完整知识图谱。

对 AI 全栈工程师来说，TypeScript 的价值在于：类型安全的前端/全栈应用、工具链、类型驱动的 API 设计、跨团队协作的类型契约。

---

## 体系架构

### Part I — 理论体系：广度 + 深度

| 编号 | 目录 | 主题 | 深度 |
|------|------|------|------|
| 01 | [`01-language-philosophy/`](01-language-philosophy/) | 设计哲学、诞生背景、与 Flow/Dart 对比 | 设计层面 |
| 02 | [`02-type-system-theory/`](02-type-system-theory/) | 结构类型、协变/逆变、类型擦除、条件类型 | 类型理论 |
| 03 | [`03-compiler-and-internals/`](03-compiler-and-internals/) | 编译器流水线、类型推断、声明文件、增量编译 | 编译器底层 |
| 04 | [`04-module-system/`](04-module-system/) | ESM/CJS、模块解析、声明文件、package.json types | 模块系统 |
| 05 | [`05-runtime-bridges-theory/`](05-runtime-bridges-theory/) | 类型守卫、断言函数、JS 互操作、渐进类型 | 运行时桥接 |
| 06 | [`06-typing-ecosystem/`](06-typing-ecosystem/) | 内置工具类型、lib.d.ts、DefinitelyTyped 生态 | 类型生态 |
| 07 | [`07-engineering-and-config/`](07-engineering-and-config/) | tsconfig、strict 模式、项目结构、API 设计 | 工程化 |
| 08 | [`08-advanced-topics/`](08-advanced-topics/) | 品牌类型、装饰器、编译性能、类型级编程极限 | 高级主题 |

### Part II — 动手训练场：代码 + 面试

| 层级 | 目录 | 内容 |
|------|------|------|
| Runtime Model | [`runtime-model/`](runtime-model/) | 值/引用、类型擦除、原型链、this、闭包、TDZ、Guard、Schema |
| Core Abstractions | [`core-abstractions/`](core-abstractions/) | interface vs type、泛型、类、函数类型、模块解析 |
| Type System Gymnastics | [`type-system-gymnastics/`](type-system-gymnastics/) | DeepReadonly、PickByValue、UnionToIntersection、String、Tuple、Curry |
| Concurrency | [`concurrency/`](concurrency/) | Event Loop、Promise、AbortController、Async Iterator、Scheduler |
| Standard Library | [`standard-library/`](standard-library/) | 手写 Partial、Pick/Omit、Record、Parameters/ReturnType |
| Engineering Patterns | [`engineering-patterns/`](engineering-patterns/) | Result、EventEmitter、Middleware、Repository、DI |
| Mini Runtime | [`mini-runtime/`](mini-runtime/) | CPromise、mini Redux、mini Router |
| Tests | [`tests/`](tests/) | 体系级测试与验证 |

---

## 学习路线

### 路线 A：从语言到系统（推荐）

```text
01 设计哲学          → 建立决策直觉
  → 02 类型系统理论   → 理解结构类型、协变/逆变、类型擦除
    → 03 编译器内部   → 掌握编译流程、类型推断
      → 04 模块系统   → ESM/CJS、module resolution、声明文件
        → 05 运行时桥接 → 类型守卫、断言、JS 互操作
          → 06 类型生态   → 内置工具类型、lib.d.ts、@types
            → 07 工程与配置 → tsconfig、strict、项目结构、API 设计
              → 08 高级主题   → 品牌类型、装饰器、编译性能、类型极限
```

### 路线 B：面试导向（快速）

```text
02 类型系统理论 + 05 运行时桥接 → 面经核心
  → 03 编译器 + 04 模块系统    → 展示深度
    → 07 工程化               → 展示工程能力
      → 动手训练场 30 题       → 手写代码 + 运行验证
```

### 路线 C：动手优先（工程导向）

```text
runtime-model/           → 值/引用、原型链、this、Guard、Schema（写代码跑实验）
  → core-abstractions/     → interface vs type、泛型、类、模块（手写实现）
    → type-system-gymnastics/ → DeepReadonly、UnionToIntersection、String、Tuple
      → concurrency/          → Event Loop、Promise、AbortController
        → standard-library/     → 手写所有内置工具类型
          → engineering-patterns/ → Result、EventEmitter、Middleware
            → mini-runtime/       → CPromise、Redux、Router
              → 配合 Part I 理论深化
```

---

## 核心 30 题（训练场索引）

| 序号 | 题目 | 推荐目录 | 状态 |
|------|------|---------|------|
| 1 | 值/引用实验与 const 语义 | `runtime-model/value-vs-reference/` | todo |
| 2 | 类型擦除后的 typeof/instanceof 差距 | `runtime-model/type-erasure-runtime/` | todo |
| 3 | 原型链与 class 语法糖转换 | `runtime-model/prototype-chain/` | todo |
| 4 | this 四种绑定规则实验 | `runtime-model/this-binding/` | todo |
| 5 | 闭包与循环变量捕获陷阱 | `runtime-model/closure-capture/` | todo |
| 6 | var/let/const 提升与 TDZ | `runtime-model/hoisting-tdz/` | todo |
| 7 | 类型守卫与断言函数 | `runtime-model/guard-and-assert/` | ready |
| 8 | Schema 校验与类型推导 | `runtime-model/schema-bridge/` | ready |
| 9 | interface vs type 使用场景对比 | `core-abstractions/interface-vs-type/` | todo |
| 10 | 泛型约束与默认参数 | `core-abstractions/generics-in-depth/` | todo |
| 11 | 类的继承与抽象类 | `core-abstractions/class-abstraction/` | todo |
| 12 | 函数类型与重载 | `core-abstractions/function-types/` | todo |
| 13 | 模块解析实验 | `core-abstractions/module-resolution-lab/` | todo |
| 14 | 递归只读 DeepReadonly | `type-system-gymnastics/deep-readonly/` | ready |
| 15 | 按值类型筛选 key | `type-system-gymnastics/pick-by-value/` | ready |
| 16 | 联合转交叉 | `type-system-gymnastics/union-to-intersection/` | ready |
| 17 | 字符串操作类型 | `type-system-gymnastics/string-manipulation/` | todo |
| 18 | 元组操作类型 | `type-system-gymnastics/tuple-manipulation/` | todo |
| 19 | 函数柯里化类型 | `type-system-gymnastics/curry-and-pipe/` | todo |
| 20 | Event Loop 可视化 | `concurrency/event-loop/` | todo |
| 21 | Promise 组合模式 | `concurrency/promise-patterns/` | todo |
| 22 | AbortController 取消信号 | `concurrency/abort-controller/` | todo |
| 23 | Async Generator | `concurrency/async-iterator/` | todo |
| 24 | 手写 Partial | `standard-library/implement-partial/` | todo |
| 25 | 手写 Pick / Omit | `standard-library/implement-pick-omit/` | todo |
| 26 | 手写 Record | `standard-library/implement-record/` | todo |
| 27 | 手写 Parameters / ReturnType | `standard-library/implement-parameters/` | todo |
| 28 | 显式错误建模 Result | `engineering-patterns/result/` | ready |
| 29 | 类型安全事件系统 | `engineering-patterns/typed-event-emitter/` | ready |
| 30 | 手写 Promise 状态机 | `mini-runtime/cpromise/` | ready |
| 31 | 手写 Redux + 类型推导 | `mini-runtime/mini-redux/` | todo |
| 32 | 手写 Router + 参数提取 | `mini-runtime/mini-router/` | todo |

---

## 面试主轴

| 主轴 | 必须能讲清楚的问题 | 对应 Part I 章节 |
|------|------------------|----------------|
| 类型模型 | 结构类型 vs 名义类型、类型擦除、协变/逆变、条件类型分配律 | 02 |
| 运行时模型 | 值/引用、原型链、this、闭包、类型擦除后的 typeof | 01、05 |
| 编译模型 | 编译流程、类型推断、.d.ts 生成、增量编译 | 03 |
| 模块模型 | ESM/CJS、module resolution、exports/types 字段 | 04 |
| 并发模型 | Event Loop、微任务/宏任务、Promise 状态机、取消信号 | 05、concurrency |
| 工程模型 | strict 模式、tsconfig、类型安全 API 设计、monorepo | 07 |

---

## 运行约定

### 训练场代码

```bash
cd language/typescript
# 运行时测试
mini-runtime/cpromise/node_modules/.bin/vitest run --config vitest.config.ts

# 类型测试
cd mini-runtime/cpromise && npx tsc --noEmit ../type-system-gymnastics/*/test.ts
```

### 理论体系阅读

```text
01-language-philosophy/
  → 02-type-system-theory/
    → 03-compiler-and-internals/
      → 04-module-system/
        → 05-runtime-bridges-theory/
          → 06-typing-ecosystem/
            → 07-engineering-and-config/
              → 08-advanced-topics/
```

---

## 状态说明

| 标记 | 含义 |
|------|------|
| `seed` | 已建立目录与架构框架 |
| `todo` | 待补充代码实现或详细内容 |
| `ready` | 已完成并可运行验证 |

当前状态：
- **Part I 理论体系**：8 个模块架构已建立，待逐层深化内容
- **Part II 训练场**：目录与题单已建立，8/32 题已完成，待逐一实现
