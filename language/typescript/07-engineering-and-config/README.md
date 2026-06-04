# TypeScript 工程实践与配置

这一层讲「如何用 TypeScript 写出可维护、可测试、高性能的生产代码」。不是类型体操，而是工程化的类型安全。

---

## 目录

| 文件 | 主题 |
|------|------|
| [`tsconfig-deep-dive.md`](tsconfig-deep-dive.md) | 所有 `compilerOptions` 详解与使用场景 |
| [`strict-mode.md`](strict-mode.md) | `strict` 家族开关的启用策略 |
| [`project-structure.md`](project-structure.md) | 项目结构、Monorepo 类型管理、路径映射 |
| [`api-design.md`](api-design.md) | 类型安全 API 设计原则 |

---

## 核心问题

1. `strictNullChecks` 为什么是最重要的严格模式开关？
2. `noImplicitAny` 和 `strict` 的关系是什么？
3. 在 Monorepo 中如何管理跨包的类型引用？
4. 如何设计一个「类型安全但不过度约束」的公共 API？

---

## 关联训练场

- `../engineering-patterns/` — 工程模式训练
- `../mini-runtime/` — 迷你框架实现
