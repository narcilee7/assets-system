# TypeScript 运行时桥接理论

TypeScript 的类型系统在编译期工作，但代码运行在 JavaScript 引擎中。这一层理解类型与运行时的边界：类型收窄、类型守卫、断言函数、以及与 JavaScript 生态的互操作。

---

## 目录

| 文件 | 主题 |
|------|------|
| [`type-guards-theory.md`](type-guards-theory.md) | 类型收窄的编译期与运行时机制 |
| [`assertion-functions.md`](assertion-functions.md) | `asserts x is T` 的语义与实现 |
| [`js-interop.md`](js-interop.md) | `any`、`unknown`、`@ts-ignore`、 gradual typing |

---

## 核心问题

1. 类型守卫 `x is T` 在编译后变成了什么？
2. 断言函数和类型守卫在调用点后的类型收窄有何不同？
3. `unknown` 和 `any` 在工程中的取舍是什么？
4. 渐进类型（Gradual Typing）如何影响大型 JS 项目的迁移？

---

## 关联训练场

- `../runtime-model/guard-and-assert/` — 类型守卫与断言函数实践
- `../runtime-model/schema-bridge/` — 运行时 schema 校验 + 类型推导
