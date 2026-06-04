# Python 语言哲学与设计原则

回答「Python 为什么设计成现在这样」，建立对语言决策的直觉。

---

## 目录

### 哲学与决策

| 文件 | 主题 |
|------|------|
| `birth-and-goals.md` | 诞生背景、设计目标、明确不追求什么 |
| `design-principles.md` | 核心设计哲学：简洁、可读、显式优于隐式 |
| `language-comparisons.md` | 与 Ruby、JavaScript、Go、Java 的深度对比 |
| `anti-features.md` | Python 故意不提供什么（如私有访问控制、静态类型强制） |
| `evolution.md` | 从 Python 2 到 3 到 3.12+ 的演进时间线 |
| `gil-and-threads.md` | GIL 的设计、影响、以及绕过策略 |

### 语言核心机制

| 文件 | 主题 |
|------|------|
| `keywords.md` | Python 关键字全景 |
| `language-spec.md` | 完整语言特性：类型、声明、控制流、OOP、异常 |
| `object-model.md` | 一切皆对象、名字绑定、引用语义、可变/不可变 |

---

## 学习路线

### 快速建立直觉（30 分钟）
```text
birth-and-goals.md
  → design-principles.md
    → object-model.md
```

### 语言机制落地（2 小时）
```text
keywords.md
  → language-spec.md
    → object-model.md
      → gil-and-threads.md
        → language-comparisons.md
          → anti-features.md
```

---

## 模块关联

| 本章概念 | 深入方向 |
|---------|---------|
| 对象模型 | → `../02-type-system-theory/` 鸭子类型、Protocol |
| GIL | → `../03-interpreter-and-runtime/` CPython 解释器、内存管理 |
| 迭代协议 | → `../05-standard-library-deep-dive/` itertools、生成器 |
| 装饰器与描述符 | → `../08-advanced-topics/` 元类、描述符协议 |
| 并发设计 | → `../04-concurrency-in-depth/` asyncio、线程、进程 |
