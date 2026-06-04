# TypeScript 编译器与内部机制

这一层深入 TypeScript 的「黑盒」：源代码如何被解析、类型如何被检查、声明文件如何生成、编译性能如何优化。

---

## 目录

| 文件 | 主题 |
|------|------|
| [`compiler-pipeline.md`](compiler-pipeline.md) | Scanner → Parser → Binder → Checker → Emitter |
| [`type-inference.md`](type-inference.md) | 类型推断算法：上下文敏感、泛型推导、最佳公共类型 |
| [`declaration-emit.md`](declaration-emit.md) | `.d.ts` 生成原理与常见问题 |
| [`incremental-compilation.md`](incremental-compilation.md) | `--watch`、Project References、Build Mode |

---

## 核心问题

1. tsc 的完整编译流程是什么？每个阶段输出什么？
2. 类型推断算法如何在有/无显式注解时工作？
3. 为什么有时候 `.d.ts` 生成会失败或产生 `any`？
4. 如何诊断大型项目的编译性能瓶颈？

---

## 关联训练场

- `../core-abstractions/module-resolution-lab/` — 模块解析实验
- `../07-engineering-and-config/` — tsconfig 配置与性能调优
