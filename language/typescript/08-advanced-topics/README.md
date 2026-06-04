# TypeScript 高级主题

这一层探索 TypeScript 的边界能力：品牌类型、装饰器、编译性能极限、以及类型级编程的理论限制。

---

## 目录

| 文件 | 主题 |
|------|------|
| [`branded-opaque-types.md`](branded-opaque-types.md) | 在结构类型系统中模拟名义类型 |
| [`decorators.md`](decorators.md) | 实验性 Decorator 的演进（legacy vs TC39） |
| [`compiler-performance.md`](compiler-performance.md) | 编译性能诊断与优化 |
| [`type-level-programming-limits.md`](type-level-programming-limits.md) | 递归深度、实例化计数、类型膨胀 |

---

## 核心问题

1. 如何用交叉类型和 `unique symbol` 创建不可伪造的品牌类型？
2. TypeScript 5.0 的 Decorator 与之前的 legacy 装饰器有何本质区别？
3. `extends` 条件类型的实例化深度限制是多少？如何设计不触发限制的类型？
4. 大型项目中如何诊断类型膨胀（type bloat）？

---

## 关联训练场

- `../type-system-gymnastics/` — 类型体操的极限实践
