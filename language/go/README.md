# Go

Go 这条线训练系统工程里的核心能力：值语义、接口组合、错误处理、goroutine / channel、context、标准库和服务端基础设施。

对 AI 全栈工程师来说，Go 的价值在于：写高并发服务、工具服务、网关、任务调度器、Agent 工具执行器和基础设施组件。

## 能力层

| 层级 | 目录 | 内容 |
| --- | --- | --- |
| Runtime Model | `runtime-model/` | 值 / 指针、逃逸分析、slice / map、method set、defer |
| Core Abstractions | `core-abstractions/` | struct、interface、embedding、generic、error |
| Concurrency | `concurrency/` | goroutine、channel、select、sync、context、worker pool |
| Standard Library | `standard-library/` | testing、net/http、io、encoding/json、time、context |
| Engineering Patterns | `engineering-patterns/` | middleware、repository、retry、rate limit、event bus、graceful shutdown |
| Mini Runtime | `mini-runtime/` | mini http server、mini task queue、mini agent tool runner |

## 推荐路线

```text
值语义 / 指针 / slice / map
-> struct / method / interface
-> error / defer / panic recover
-> goroutine / channel / select
-> context / cancellation / timeout
-> testing / benchmark / race
-> net/http / middleware
-> worker pool / task queue
-> mini service runtime
```

## 核心 40 题

| 序号 | 题目 | 推荐目录 | 状态 |
| --- | --- | --- | --- |
| 1 | 手写 slice append 现象解释和扩容实验 | `runtime-model/` | todo |
| 2 | 手写 map 计数器并说明并发风险 | `runtime-model/` | todo |
| 3 | 手写 pointer swap / value receiver 对比 | `runtime-model/` | todo |
| 4 | 手写 defer 执行顺序题 | `runtime-model/` | todo |
| 5 | 手写逃逸分析示例 | `runtime-model/` | todo |
| 6 | 手写 method set 示例 | `core-abstractions/` | todo |
| 7 | 手写 interface nil 陷阱示例 | `core-abstractions/` | todo |
| 8 | 手写 error wrapping / errors.Is / errors.As | `core-abstractions/` | todo |
| 9 | 手写泛型 Stack | `core-abstractions/` | todo |
| 10 | 手写泛型 Set | `core-abstractions/` | todo |
| 11 | 手写 goroutine fan-out / fan-in | `concurrency/` | todo |
| 12 | 手写 channel pipeline | `concurrency/` | todo |
| 13 | 手写 select timeout | `concurrency/` | todo |
| 14 | 手写 worker pool | `concurrency/` | todo |
| 15 | 手写 bounded parallel map | `concurrency/` | todo |
| 16 | 手写 sync.Once | `concurrency/` | todo |
| 17 | 手写 safe counter | `concurrency/` | todo |
| 18 | 手写 context cancellation | `concurrency/` | todo |
| 19 | 手写 context timeout request | `concurrency/` | todo |
| 20 | 手写 graceful shutdown | `concurrency/` | todo |
| 21 | 手写 table-driven tests | `standard-library/` | todo |
| 22 | 手写 benchmark | `standard-library/` | todo |
| 23 | 手写 HTTP handler | `standard-library/` | todo |
| 24 | 手写 JSON decode validation | `standard-library/` | todo |
| 25 | 手写 io.Reader / io.Writer adapter | `standard-library/` | todo |
| 26 | 手写 middleware chain | `engineering-patterns/` | todo |
| 27 | 手写 retry with backoff | `engineering-patterns/` | todo |
| 28 | 手写 token bucket rate limiter | `engineering-patterns/` | todo |
| 29 | 手写 in-memory repository | `engineering-patterns/` | todo |
| 30 | 手写 event bus | `engineering-patterns/` | todo |
| 31 | 手写 config loader | `engineering-patterns/` | todo |
| 32 | 手写 structured logger adapter | `engineering-patterns/` | todo |
| 33 | 手写 mini router | `mini-runtime/` | todo |
| 34 | 手写 mini task queue | `mini-runtime/` | todo |
| 35 | 手写 mini scheduler | `mini-runtime/` | todo |
| 36 | 手写 mini cache with TTL | `mini-runtime/` | todo |
| 37 | 手写 mini pubsub | `mini-runtime/` | todo |
| 38 | 手写 mini agent tool runner | `mini-runtime/` | todo |
| 39 | 手写 SSE server | `mini-runtime/` | todo |
| 40 | 手写 health check + metrics endpoint | `mini-runtime/` | todo |

## Go 面试主轴

| 主轴 | 必须能讲清楚的问题 |
| --- | --- |
| 内存模型 | slice 扩容、map 并发风险、逃逸分析、GC 基本行为 |
| 接口模型 | interface 动态类型、nil interface、method set、embedding |
| 并发模型 | goroutine 调度、channel 关闭原则、select、公平性、泄漏 |
| 取消模型 | context 传播、timeout、deadline、request-scoped value |
| 错误模型 | error wrapping、sentinel error、panic / recover 边界 |
| 工程模型 | middleware、graceful shutdown、测试、benchmark、race detector |

## 运行约定

Go 资产默认使用标准工具链：

```bash
go test ./...
go test -race ./...
go test -bench=. ./...
```

第一阶段可以先不引入第三方包，优先使用标准库建立扎实底层直觉。

