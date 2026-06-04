# Java 语言哲学与设计原则

回答「Java 为什么设计成现在这样」，建立对语言决策的直觉。

---

## 目录

### 哲学与决策

| 文件 | 主题 |
|------|------|
| `birth-and-goals.md` | 诞生背景、设计目标、明确不追求什么 |
| `design-principles.md` | 核心设计哲学：OOP、WORA、安全、简单 |
| `language-comparisons.md` | 与 Kotlin、Scala、C#、Go 的深度对比 |
| `anti-features.md` | Java 故意不提供什么（如运算符重载、多重继承） |
| `evolution.md` | 从 Java 1.0 到 21+ 的演进时间线 |

### 语言核心机制

| 文件 | 主题 |
|------|------|
| `keywords.md` | Java 关键字全景 |
| `language-spec.md` | 完整语言特性：类型、声明、控制流、OOP、异常 |
| `oop-deep-dive.md` | 封装、继承、多态、抽象在 Java 中的实现 |

---

## 学习路线

### 快速建立直觉（30 分钟）
```text
birth-and-goals.md
  → design-principles.md
    → oop-deep-dive.md
```

### 语言机制落地（2 小时）
```text
keywords.md
  → language-spec.md
    → oop-deep-dive.md
      → language-comparisons.md
        → anti-features.md
```

---

## 模块关联

| 本章概念 | 深入方向 |
|---------|---------|
| OOP 设计 | → `../02-type-system-theory/` 泛型、类型边界 |
| 类加载机制 | → `../03-jvm-and-runtime/` JVM 类加载器、内存模型 |
| 异常设计 | → `../07-engineering-and-design/` 错误处理最佳实践 |
| 函数式接口 | → `../04-concurrency-in-depth/` CompletableFuture、Reactive |
| 编译速度 | → `../06-compiler-and-build-tools/` javac、模块化 |
