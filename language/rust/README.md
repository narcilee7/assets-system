# Rust Language

Rust 语言层训练的是"理解编译器为什么要这样约束我"的能力——所有权、借用、生命周期、trait、async 运行时、手写安全数据结构。它不是按语法点堆材料，而是用同一张能力地图去理解其他语言里被隐藏的复杂度。

## 语言矩阵中的定位

| 语言 | 目录 | 核心价值 |
| --- | --- | --- |
| JavaScript | `language/javascript/` | 浏览器 / Node 运行时、原型链、异步 |
| TypeScript | `language/typescript/` | 类型建模、运行时桥接、工程约束 |
| Python | `language/python/` | 对象模型、协议、装饰器、描述符、asyncio |
| Go | `language/go/` | 并发、接口组合、系统工程基础设施 |
| Java | `language/java/` | 企业级后端、JVM、Spring 生态 |
| **Rust** | `language/rust/` | **内存安全、零成本抽象、显式 async、trait、unsafe 边界** |

## Rust 能力地图

| 层级 | 训练内容 | 面试 / 工程价值 |
| --- | --- | --- |
| Runtime Model | 值/引用语义、所有权、借用、生命周期、内存布局、NLL | 解释"为什么编译不过 / 怎样改才对" |
| Core Abstractions | struct / enum / trait / 泛型 / 关联类型 / 错误模型 | 写出 Rust 惯用抽象 |
| Type System | trait bound、where 子句、高阶 trait 边界 (HRTB)、GAT、phantom | 表达"类型即文档" |
| Concurrency | `Future` / `Pin` / `Waker`、Tokio 调度、`Send`/`Sync`、取消 | 处理真实 I/O、任务调度和资源限制 |
| Standard Library | `Option` / `Result` / `Iterator` / `Vec` / `HashMap` / `Cow` | 用好零成本抽象 |
| Engineering Patterns | RAII、Builder、Newtype、Type State、错误传播 | 从题目迁移到工程 |
| Mini Runtime | 手写 `Future`、手写 `Box`、`LruCache`、简单 runtime | 把零散机制组合成框架级理解 |

## 统一体系架构

跟其他语言一致的双层架构（详见 `language/README.md`）：

```text
language/rust/
├── README.md                    # 本文件：总览 + 学习路线 + 题单索引
│
├── Part I — 理论体系
│   ├── 01-language-philosophy/   # 设计哲学：内存安全 + 零成本抽象 + 并发安全
│   ├── 02-type-system-theory/    # 类型系统：trait、子类型、方差、HRTB、GAT
│   ├── 03-ownership-and-runtime/ # 所有权/借用/生命周期 + 内存模型（语言机制）
│   ├── 04-async-in-depth/        # Future/Pin/Waker + Tokio 调度（替代 04-concurrency）
│   ├── 05-standard-library/      # 标准库深度
│   ├── 06-toolchain-and-build/   # rustc/cargo/clippy/rustfmt + workspace
│   ├── 07-engineering-and-design/# 工程化：特性标志、crate 划分、文档、测试
│   └── 08-advanced-topics/       # unsafe / soundness / FFI / WASM / 嵌入式
│
└── Part II — 动手训练场
    ├── runtime-model/            # 所有权/借用 + 生命周期直觉
    ├── core-abstractions/        # struct/enum/trait/泛型/错误模型
    ├── type-system-gymnastics/   # trait 体操 + HRTB + GAT
    ├── concurrency/              # 手写 Future + Tokio 实践
    ├── standard-library/         # 容器 / I/O / 时间 / 序列化
    ├── engineering-patterns/     # RAII / Newtype / Type State / Builder
    └── mini-runtime/             # 手写 mini Future、LruCache、Channel 等
```

> 注：相比 Go/Python 的 `04-concurrency-in-depth`，Rust 用 `04-async-in-depth` 替换——因为"并发"在 Rust 里本质是 async runtime（Tokio/async-std）+ `Send`/`Sync` 约束，而不是裸 goroutine。

## 单题资产结构

每个语言资产最终都应该包含：

```text
README.md
impl.rs
test.rs  (或 #[cfg(test)] mod tests 内联)
review.md
```

最低完成标准：

- 说清楚考点和真实场景。
- 实现可编译、可运行。
- 测试覆盖正常、边界、易错路径（生命周期错借用、所有权移动、async 取消）。
- 复盘语言机制和工程取舍。

## 横向对照专题（与 Rust 相关的部分）

| 专题 | Rust | C++ | Go | Java |
| --- | --- | --- | --- | --- |
| 内存安全 | 编译期所有权 + 借用检查 | 程序员自律 / RAII | GC | GC |
| 错误处理 | `Result<T, E>` + `?` | 异常 / `std::expected` | `error` 多返回值 | checked Exception |
| 资源管理 | RAII / `Drop` | RAII / 智能指针 | `defer` | try-with-resources |
| 异步模型 | `Future` + `Pin` + Tokio | callback / coroutine (C++20) | goroutine | `CompletableFuture` |
| 类型系统 | trait + HRTB + GAT | template / concept | interface (结构) | interface (名义) |
| FFI | `extern "C"` + `bindgen` | 原生 | CGO | JNI |
| Unsafe 边界 | `unsafe` 块 + soundness 注释 | 全程 unsafe | 无 unsafe 概念 | JNI / `sun.misc.Unsafe` |

## 题单索引（待落地）

> 当前 `seed` 状态：以下是规划题单，每个都按"机制 + 边界 + 追问"训练。

### Part I — 理论体系

| 模块 | 核心主题 | 状态 |
| --- | --- | --- |
| `01-language-philosophy/` | 设计哲学：与 C++/Go 对比、零成本抽象、内存安全目标 | seed |
| `02-type-system-theory/` | trait、子类型、方差、HRTB、GAT、phantom type | seed |
| `03-ownership-and-runtime/` | 所有权、借用、NLL、生命周期、内存布局、`Drop` | seed |
| `04-async-in-depth/` | `Future` 状态机、`Pin`、`Waker`、Tokio 调度、取消 | seed |
| `05-standard-library/` | `Option`/`Result`/`Iterator`/`Cow`/`Box`/`Arc` | seed |
| `06-toolchain-and-build/` | rustc、cargo、clippy、rustfmt、workspace、特性标志 | seed |
| `07-engineering-and-design/` | crate 划分、可见性、文档、`unsafe` 治理 | seed |
| `08-advanced-topics/` | soundness、FFI、WASM、嵌入式、`no_std` | seed |

### Part II — 动手训练场

| 模块 | 题单 | 状态 |
| --- | --- | --- |
| `runtime-model/` | move/clone、借用规则、生命周期标注、生命周期省略 (elision)、内部可变性 `Cell`/`RefCell` | seed |
| `core-abstractions/` | enum 代数数据类型、trait 对象 vs 泛型、关联类型、`From`/`TryFrom` | seed |
| `type-system-gymnastics/` | Newtype、PhantomData、Type State、Builder 状态机、HRTB | seed |
| `concurrency/` | 手写 `Future`、`Pin<&mut Self>` 推导、Tokio task 取消、`Send` 边界 | seed |
| `standard-library/` | 自实现 `LruCache`、`Vec` 扩容实验、`HashMap` 行为、`Iterator` 适配器 | seed |
| `engineering-patterns/` | RAII 资源管理、错误传播链、模块化错误类型、配置层设计 | seed |
| `mini-runtime/` | 手写 mini `Future` runtime、手写 `mpsc` channel、手写 trait object 调度器 | seed |

## 训练路线

```text
Runtime Model（所有权 / 借用 / 生命周期）
  -> Core Abstractions（trait / 泛型 / 错误模型）
  -> Concurrency（手写 Future + Tokio）
  -> Standard Library（容器 / Iterator 适配器）
  -> Engineering Patterns（Newtype / Type State / RAII）
  -> Mini Runtime（手写小运行时，把零散机制组合成框架级理解）
```

## 与其他主线的关系

- `engineering/rust/`：用 Rust 写出可上线的工程构件（Axum、SQLx、gRPC、可观测性）。
- `systems-engineering/`：低层 OS/网络的 Rust 落地点（eBPF、用户态网络）。
- `artificial-intelligence/`：高性能推理、训练基础设施（burn、tch-rs）。
- `ai-fullstack/`：AI Backend 的类型安全实现层（Tool Registry、Streaming、RAG）。