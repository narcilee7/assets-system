# TypeScript 语言哲学与设计原则

回答「TypeScript 为什么设计成现在这样」，建立对语言决策的直觉。

---

## 目录

### 哲学与决策

| 文件 | 主题 |
|------|------|
| [`birth-and-goals.md`](birth-and-goals.md) | 诞生背景、设计目标、明确不追求什么 |
| [`design-principles.md`](design-principles.md) | 核心设计哲学 |
| [`language-comparisons.md`](language-comparisons.md) | 与 Flow、Dart、ReasonML 的深度对比 |
| [`anti-features.md`](anti-features.md) | TypeScript 故意不提供什么 |
| [`type-vs-interface.md`](type-vs-interface.md) | `type` 与 `interface` 的决策树 |

### 语言核心机制

| 文件 | 主题 |
|------|------|
| [`keywords.md`](keywords.md) | TypeScript 关键字与运算符全景 |
| [`language-spec.md`](language-spec.md) | 完整语言特性：类型、声明、控制流、模块、类、接口 |

---

## 学习路线

### 快速建立直觉（30 分钟）
```text
birth-and-goals.md
  → design-principles.md
    → type-vs-interface.md
```

### 语言机制落地（2 小时）
```text
keywords.md
  → language-spec.md
    → type-vs-interface.md
      → language-comparisons.md
        → anti-features.md
```

---

## 模块关联

| 本章概念 | 深入方向 |
|---------|---------|
| 结构类型系统 | → `../02-type-system-theory/` 类型层级、协变/逆变 |
| 类型擦除 | → `../03-compiler-and-internals/` 编译器 emitter |
| 模块系统 | → `../04-module-system/` ESM/CJS、module resolution |
| 装饰器（实验性） | → `../08-advanced-topics/` Decorator 演进 |
| 工程化配置 | → `../07-engineering-and-config/` tsconfig、strict 模式 |
