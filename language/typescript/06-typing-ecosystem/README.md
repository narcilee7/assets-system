# TypeScript 类型生态

这一层理解 TypeScript 内置工具类型、lib.d.ts 的结构、以及 DefinitelyTyped 生态如何支撑整个 JS/TS 世界的类型安全。

---

## 目录

| 文件 | 主题 |
|------|------|
| [`built-in-utility-types.md`](built-in-utility-types.md) | Partial / Required / Pick / Omit / Record / Parameters / ReturnType 的实现原理 |
| [`lib-d-ts.md`](lib-d-ts.md) | lib.d.ts 的结构、DOM 类型、自定义 lib |
| [`definitely-typed.md`](definitely-typed.md) | @types 生态、类型发布、dtslint |

---

## 核心问题

1. `Partial<T>` 和 `Required<T>` 如何利用 mapped type 的修饰符？
2. `lib.d.ts` 中的 `ES2020` 和 `DOM` 是如何被选择性包含的？
3. 如何为一个新库发布高质量的 `@types` 包？

---

## 关联训练场

- `../standard-library/` — 手写实现所有内置工具类型
