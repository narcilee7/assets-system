# Language Runtime

语言层训练的是“运行时直觉 + 抽象表达 + 工程迁移”。它不是按语法点堆材料，而是用同一张能力地图去理解 JavaScript、TypeScript、Python、Go 和 Java。

## 语言矩阵

| 语言 | 目录 | 核心价值 | 体系状态 |
| --- | --- | --- | --- |
| JavaScript | `javascript/` | 浏览器 / Node 运行时、原型链、异步和前端基础 | Part I 待建，Part II 手写题资产化中 |
| TypeScript | `typescript/` | 类型建模、运行时桥接、工程约束 | **Part I 8模块 + Part II 7模块 框架已建立**，8/32题已完成 |
| Python | `python/` | 对象模型、协议、装饰器、描述符、asyncio | **Part I 8模块 + Part II 7模块 框架已建立**，deep_copy 已完成 |
| Go | `go/` | 并发、接口组合、系统工程、服务端基础设施 | **Part I 8模块 + Part II 7模块 框架已建立**，01 理论部分较充实 |
| Java | `java/` | 企业级后端、JVM、Spring 生态、高并发服务 | **Part I 8模块 + Part II 7模块 框架已建立**，待填充代码 |

## 统一能力层

每门语言都映射到下面这张能力地图，方便横向比较和长期复盘。

| 层级 | 训练内容 | 面试 / 工程价值 |
| --- | --- | --- |
| Runtime Model | 值、引用、内存、对象 / 类型模型、调用栈、逃逸 | 解释“为什么这样运行” |
| Core Abstractions | 函数、闭包、接口、协议、泛型、错误模型 | 写出语言惯用抽象 |
| Concurrency | event loop、asyncio、goroutine、channel、锁、取消 | 处理真实 I/O、任务调度和资源限制 |
| Standard Library | 常用容器、I/O、网络、时间、序列化、测试 | 快速构建可靠小系统 |
| Engineering Patterns | 重试、限流、缓存、DI、事件、事务边界 | 从题目迁移到工程 |
| Mini Runtime | mini Promise、mini FastAPI、mini Agent Runtime 等 | 把零散机制组合成框架级理解 |

## 统一体系架构

所有语言采用一致的双层架构：

```text
language/<lang>/
├── README.md                    # 总览 + 学习路线 + 题单索引
│
├── Part I — 理论体系
│   ├── 01-language-philosophy/   # 设计哲学、诞生背景、语言对比
│   ├── 02-type-system-theory/    # 类型系统理论
│   ├── 03-compiler-and-runtime/  # 编译器 / 解释器 / JVM / 运行时
│   ├── 04-module-system/         # 模块系统（可选，JS/TS/Go 重点）
│   ├── 04-concurrency-in-depth/  # 并发深度（Python/Go/Java）
│   ├── 05-standard-library/      # 标准库深度
│   ├── 06-compiler-and-build/    # 编译与构建工具
│   ├── 07-engineering-and-design/# 工程化
│   └── 08-advanced-topics/       # 高级主题
│
└── Part II — 动手训练场
    ├── runtime-model/            # 运行时直觉
    ├── core-abstractions/        # 核心抽象
    ├── type-system-gymnastics/   # 类型体操（TS/Python）
    ├── concurrency/              # 并发实践
    ├── standard-library/         # 标准库训练
    ├── engineering-patterns/     # 工程模式
    ├── mini-runtime/             # 迷你框架
    └── tests/                    # 统一测试
```

> 注：各语言根据特性微调目录命名。例如 Go 的 `03-memory-and-runtime/`、Python 的 `03-interpreter-and-runtime/`、Java 的 `03-jvm-and-runtime/`。

## 单题资产结构

每个语言资产最终都应该包含：

```text
README.md
impl.*
test.*
review.md
```

最低完成标准：

- 说清楚考点和真实场景。
- 实现可运行。
- 测试覆盖正常、边界、易错路径。
- 复盘语言机制和工程取舍。

## 横向对照专题

后续可以逐步建立跨语言专题：

| 专题 | JS / TS | Python | Go | Java |
| --- | --- | --- | --- | --- |
| 异步模型 | Event Loop / Promise | asyncio / coroutine | goroutine / channel | ThreadPool / CompletableFuture |
| 对象模型 | prototype / class | object / descriptor | struct / method set / interface | class / interface / 反射 |
| 错误处理 | throw / Result-like | exception / context manager | error / panic / recover | Exception / checked vs unchecked |
| 资源管理 | AbortController | context manager | defer / context | try-with-resources |
| 泛型 / 类型 | TypeScript generics | typing / protocol | Go generics / interface | 泛型擦除 / 通配符 |
| 类型系统 | 结构类型 | 鸭子类型 / 名义类型 | 结构类型 | 名义类型 |

## 近期优先级

1. **TypeScript 填充**：核心理论文档（keywords、language-spec）+ 训练场代码（字符串类型、Event Loop、内置工具类型）
2. **Python 填充**：Part I 理论文档 + 训练场代码（装饰器、描述符、asyncio）
3. **Go 填充**：训练场代码实现（slice、map、goroutine、worker pool）
4. **Java 填充**：Part I 理论文档 + 训练场代码（Collections、并发、设计模式）
5. **JS 体系化**：建立与 TS 一致的 Part I + Part II 框架
