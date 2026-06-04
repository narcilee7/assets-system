# Go 语言哲学与设计原则

回答「Go 为什么设计成现在这样」，建立对语言决策的直觉。

---

## 目录

### 哲学与决策

| 文件 | 主题 |
|------|------|
| [`birth-and-goals.md`](birth-and-goals.md) | 诞生背景、设计目标、明确不追求什么 |
| [`design-principles.md`](design-principles.md) | 五大设计哲学 |
| [`core-decisions.md`](core-decisions.md) | 四个本质决策 |
| [`value-vs-reference.md`](value-vs-reference.md) | 值语义与引用语义 |
| [`language-comparisons.md`](language-comparisons.md) | 多语言深度对比 |
| [`anti-features.md`](anti-features.md) | 故意不提供什么 |
| [`evolution.md`](evolution.md) | 保守演进时间线 |
| [`discussion-framework.md`](discussion-framework.md) | 回答设计问题的思维框架 |
| [`resources.md`](resources.md) | 论文、书籍、资源 |

### 语言核心机制

| 文件 | 主题 |
|------|------|
| [**`language-spec.md`**](language-spec.md) | **Go 语言特性全景：所有语法与语义** |
| [`keywords.md`](keywords.md) | 25 个关键字全景、声明、控制流、并发 |
| [`pointers.md`](pointers.md) | 指针语法、传递选择、陷阱、逃逸分析 |
| [`interfaces.md`](interfaces.md) | 隐式实现、内部结构、nil 陷阱、断言 |
| [`methods.md`](methods.md) | 接收者、方法集、嵌入提升、函数 vs 方法 |
| [`goroutine-and-channel.md`](goroutine-and-channel.md) | goroutine、channel、select、关闭原则与并发陷阱 |

---

## 学习路线

### 快速建立直觉（30 分钟）
```text
birth-and-goals.md
  → design-principles.md
    → core-decisions.md
```

### 语言机制落地（2 小时）
```text
keywords.md
  → pointers.md
    → methods.md
      → interfaces.md
        → value-vs-reference.md
          → goroutine-and-channel.md
```

### 深度理解（完整）
```text
[语言机制落地路线]
  → language-comparisons.md
    → anti-features.md
      → evolution.md
```

---

## 模块关联

| 本章概念 | 深入方向 |
|---------|---------|
| 组合 vs 继承 | → `../02-type-system/` slice/map 实现、内存布局 |
| 指针与逃逸分析 | → `../03-memory-and-runtime/` 内存分配器、GC |
| goroutine / channel | → `../04-concurrency-in-depth/` GMP 调度、channel 实现 |
| error 设计 | → `../07-engineering-and-design/` 错误处理最佳实践 |
| interface 内部结构 | → `../03-memory-and-runtime/` iface/eface 内存布局 |
| 编译速度目标 | → `../06-compiler-and-toolchain/` 编译流程、链接器 |
| 面向工程 | → `../07-engineering-and-design/` 项目结构、测试、API 设计 |
