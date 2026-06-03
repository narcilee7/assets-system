# Language Runtime

语言层训练的是“运行时直觉 + 抽象表达 + 工程迁移”。它不是按语法点堆材料，而是用同一张能力地图去理解 JavaScript、TypeScript、Python 和 Go。

## 语言矩阵

| 语言 | 目录 | 核心价值 | 当前重点 |
| --- | --- | --- | --- |
| JavaScript | `javascript/` | 浏览器 / Node 运行时、原型链、异步和前端基础 | 整理手写题资产，补测试和复盘 |
| TypeScript | `typescript/` | 类型建模、运行时桥接、工程约束 | CPromise、类型系统和工程类型设计 |
| Python | `python/` | 对象模型、协议、装饰器、描述符、asyncio | 作为语言资产化样板继续扩展 |
| Go | `go/` | 并发、接口组合、系统工程、服务端基础设施 | 新建 Go 体系，从运行时和并发开始 |

## 统一能力层

每门语言都尽量映射到下面这些层级，方便横向比较和长期复盘。

| 层级 | 训练内容 | 面试 / 工程价值 |
| --- | --- | --- |
| Runtime Model | 值、引用、内存、对象 / 类型模型、调用栈、逃逸 | 解释“为什么这样运行” |
| Core Abstractions | 函数、闭包、接口、协议、泛型、错误模型 | 写出语言惯用抽象 |
| Concurrency | event loop、asyncio、goroutine、channel、锁、取消 | 处理真实 I/O、任务调度和资源限制 |
| Standard Library | 常用容器、I/O、网络、时间、序列化、测试 | 快速构建可靠小系统 |
| Engineering Patterns | 重试、限流、缓存、DI、事件、事务边界 | 从题目迁移到工程 |
| Mini Runtime | mini Promise、mini FastAPI、mini Agent Runtime 等 | 把零散机制组合成框架级理解 |

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

| 专题 | JS / TS | Python | Go |
| --- | --- | --- | --- |
| 异步模型 | Event Loop / Promise | asyncio / coroutine | goroutine / channel |
| 对象模型 | prototype / class | object / descriptor | struct / method set / interface |
| 错误处理 | throw / Result-like | exception / context manager | error / panic / recover |
| 资源管理 | AbortController | context manager | defer / context |
| 泛型 / 类型 | TypeScript generics | typing / protocol | Go generics / interface |

## 近期优先级

1. Go 体系起步：运行时、接口、并发、context、标准库测试。
2. JS 手写题资产化：Promise、原型链、this、数组方法、debounce/throttle。
3. TypeScript 深化：类型系统、Promise 状态机、类型和运行时边界。
4. Python 补齐核心 30 题：从 `deep_copy` 样板扩展到装饰器、描述符和 asyncio。

