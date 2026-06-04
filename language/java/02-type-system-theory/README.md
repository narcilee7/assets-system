# Java 类型系统深度解析

这一层从语言规范层面理解 Java 的类型系统：名义类型、泛型擦除、类型边界、通配符、以及类型推断。

---

## 目录

| 文件 | 主题 |
|------|------|
| `nominal-typing.md` | 名义类型系统 vs 结构类型 |
| `generics-and-erasure.md` | 泛型擦除、类型参数、桥方法 |
| `type-bounds.md` | 上界 `<T extends X>`、下界 `? super Y` |
| `wildcards-and-pecks.md` | PECS 原则：Producer-Extends, Consumer-Super |
| `type-inference.md` | 钻石运算符、局部变量类型推断（var） |

---

## 核心问题

1. Java 为什么选择名义类型而非结构类型？
2. 泛型擦除后，类型参数去了哪里？运行时还能访问吗？
3. `List<? extends Number>` 和 `List<? super Integer>` 的区别是什么？
4. PECS 原则在实际工程中如何应用？
5. 类型推断的边界：什么情况下编译器无法推断类型？

---

## 关联训练场

- `../core-abstractions/` — 泛型、Lambda、Stream 实践
- `../standard-library/` — Collections、Comparator 类型设计
