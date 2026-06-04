# TypeScript 类型系统深度解析

这一层从语言规范层面理解 TypeScript 的类型系统：不仅是「怎么用类型体操」，而是「类型如何被编译器理解、结构类型与名义类型的本质差异、协变逆变的语义、类型擦除后的运行时行为」。

---

## 目录

| 文件 | 主题 |
|------|------|
| [`structural-typing.md`](structural-typing.md) | 结构类型 vs 名义类型 |
| [`variance.md`](variance.md) | 协变 / 逆变 / 双变 + 位置分析 |
| [`type-erasure.md`](type-erasure.md) | 类型擦除与运行时行为 |
| [`conditional-types.md`](conditional-types.md) | 条件类型与分配律 |
| [`infer-mechanism.md`](infer-mechanism.md) | infer 提取与类型参数推导 |
| [`advanced-mapped-types.md`](advanced-mapped-types.md) | 模板字面量、key remapping、递归类型限制 |

---

## 核心问题

1. TypeScript 为什么选择结构类型而非名义类型？
2. `T extends U ? X : Y` 在什么情况下会触发分配律？
3. 函数参数位置为什么是逆变的？返回值位置为什么是协变的？
4. 类型擦除后，泛型参数去了哪里？运行时还能访问吗？
5. 递归类型的深度限制是多少？如何绕过？

---

## 关联训练场

- `../type-system-gymnastics/` — 类型体操实践
- `../standard-library/` — 内置工具类型手写实现
