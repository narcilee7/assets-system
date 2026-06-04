# Python 类型系统深度解析

这一层从语言规范层面理解 Python 的类型系统：鸭子类型、协议、类型提示、gradual typing。

---

## 目录

| 文件 | 主题 |
|------|------|
| `duck-typing.md` | 鸭子类型与 EAFP 原则 |
| `protocol-and-structural.md` | Protocol 类、结构类型在 Python 3.8+ 的引入 |
| `type-hints-and-annotations.md` | 类型提示语法、typing 模块、泛型 |
| `gradual-typing.md` | 渐进类型、mypy、运行时类型检查 |
| `typevar-and-generics.md` | TypeVar、泛型函数、泛型类、约束 |

---

## 核心问题

1. Python 为什么选择鸭子类型而非名义类型？
2. `Protocol` 与 `abc.ABC` 的区别和使用场景？
3. 类型提示在运行时会消失吗？`typing.get_type_hints` 能做什么？
4. mypy 的类型推断能力边界在哪里？
5. `TypeVar` 的 `bound` 与 `constraints` 有什么区别？

---

## 关联训练场

- `../type-system-gymnastics/` — Protocol、泛型、TypeVar 实践
