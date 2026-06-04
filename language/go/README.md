# Go 语言全栈体系

这一资产覆盖 Go 从**语言设计哲学**到**运行时底层**，从**类型系统**到**工程实践**的完整知识图谱。

对 AI 全栈工程师来说，Go 的价值在于：高并发服务、工具链、网关、任务调度器、Agent 执行器和基础设施组件。

---

## 体系架构

### Part I — 理论体系：广度 + 深度

| 编号 | 目录 | 主题 | 深度 |
|------|------|------|------|
| 01 | [`01-language-philosophy/`](01-language-philosophy/) | 设计哲学、语言决策、与其他语言对比 | 设计层面 |
| 02 | [`02-type-system/`](02-type-system/) | 类型系统、interface 内部实现、泛型机制、内存对齐 | 语言规范 |
| 03 | [`03-memory-and-runtime/`](03-memory-and-runtime/) | 内存分配器、逃逸分析、GC 算法、GMP 调度、内存模型 | 运行时底层 |
| 04 | [`04-concurrency-in-depth/`](04-concurrency-in-depth/) | CSP 模型、channel 实现、select 机制、context 传播、sync 原语 | 并发深度 |
| 05 | [`05-standard-library-deep-dive/`](05-standard-library-deep-dive/) | io、net/http、json、time、reflect 等核心包的设计与陷阱 | 标准库 |
| 06 | [`06-compiler-and-toolchain/`](06-compiler-and-toolchain/) | 编译流程、SSA、内联、模块系统、工具链、交叉编译 | 编译器 |
| 07 | [`07-engineering-and-design/`](07-engineering-and-design/) | 项目结构、错误处理、测试、API 设计、可观测性、优雅关闭 | 工程化 |
| 08 | [`08-advanced-topics/`](08-advanced-topics/) | CGO、unsafe、reflect、插件、WASM、汇编、运行时扩展 | 高级主题 |

### Part II — 动手训练场：代码 + 面试

| 层级 | 目录 | 内容 |
|------|------|------|
| Runtime Model | [`runtime-model/`](runtime-model/) | 值 / 指针、逃逸分析、slice / map、method set、defer |
| Core Abstractions | [`core-abstractions/`](core-abstractions/) | struct、interface、embedding、generic、error |
| Concurrency | [`concurrency/`](concurrency/) | goroutine、channel、select、sync、context、worker pool |
| Standard Library | [`standard-library/`](standard-library/) | testing、net/http、io、encoding/json、time、context |
| Engineering Patterns | [`engineering-patterns/`](engineering-patterns/) | middleware、repository、retry、rate limit、event bus、graceful shutdown |
| Mini Runtime | [`mini-runtime/`](mini-runtime/) | mini http server、mini task queue、mini agent tool runner |
| Tests | [`tests/`](tests/) | 体系级测试与验证 |

---

## 学习路线

### 路线 A：从语言到系统（推荐）

```text
01 设计哲学          → 建立决策直觉
  → 02 类型系统       → 理解内存布局与接口本质
    → 03 内存与运行时   → 掌握逃逸分析、GC、GMP 调度
      → 04 并发深度     → CSP、channel、context、同步原语
        → 05 标准库深度   → io、http、json、time 的工程用法
          → 06 编译器与工具链 → 理解代码如何变成机器码
            → 07 工程与设计   → 项目结构、测试、API、可观测性
              → 08 高级主题     → CGO、unsafe、WASM、底层hack
```

### 路线 B：面试导向（快速）

```text
02 类型系统 + 03 内存模型 → 面经核心
  → 04 并发               → Go 最大卖点
    → 05 标准库 + 07 工程   → 展示工程能力
      → 动手训练场 40 题     → 手写代码 + 运行验证
```

### 路线 C：动手优先（工程导向）

```text
runtime-model/        → slice、map、defer、逃逸分析（写代码跑实验）
  → core-abstractions/  → interface、error、泛型（手写实现）
    → concurrency/        → worker pool、context、graceful shutdown
      → standard-library/   → table-driven test、benchmark、HTTP handler
        → engineering-patterns/ → middleware、rate limiter、event bus
          → mini-runtime/       → mini router、mini cache、mini agent runner
            → 配合 Part I 理论深化
```

---

## 核心 40 题（训练场索引）

| 序号 | 题目 | 推荐目录 | 状态 |
|------|------|---------|------|
| 1 | 手写 slice append 现象解释和扩容实验 | `runtime-model/slice_append/` | todo |
| 2 | 手写 map 计数器并说明并发风险 | `runtime-model/map_counter/` | todo |
| 3 | 手写 pointer swap / value receiver 对比 | `runtime-model/receiver/` | todo |
| 4 | 手写 defer 执行顺序题 | `runtime-model/defer_order/` | todo |
| 5 | 手写逃逸分析示例 | `runtime-model/escape_analysis/` | todo |
| 6 | 手写 method set 示例 | `core-abstractions/method_set/` | todo |
| 7 | 手写 interface nil 陷阱示例 | `core-abstractions/nil_interface/` | todo |
| 8 | 手写 error wrapping / errors.Is / errors.As | `core-abstractions/error_wrapping/` | todo |
| 9 | 手写泛型 Stack | `core-abstractions/generic_stack/` | todo |
| 10 | 手写泛型 Set | `core-abstractions/generic_set/` | todo |
| 11 | 手写 goroutine fan-out / fan-in | `concurrency/fan_out_fan_in/` | todo |
| 12 | 手写 channel pipeline | `concurrency/channel_pipeline/` | todo |
| 13 | 手写 select timeout | `concurrency/select_timeout/` | todo |
| 14 | 手写 worker pool | `concurrency/worker_pool/` | todo |
| 15 | 手写 bounded parallel map | `concurrency/bounded_parallel_map/` | todo |
| 16 | 手写 sync.Once | `concurrency/sync_once/` | todo |
| 17 | 手写 safe counter | `concurrency/safe_counter/` | todo |
| 18 | 手写 context cancellation | `concurrency/context_cancellation/` | todo |
| 19 | 手写 context timeout request | `concurrency/context_timeout_request/` | todo |
| 20 | 手写 graceful shutdown | `concurrency/graceful_shutdown/` | todo |
| 21 | 手写 table-driven tests | `standard-library/table_driven_tests/` | todo |
| 22 | 手写 benchmark | `standard-library/benchmark/` | todo |
| 23 | 手写 HTTP handler | `standard-library/http_handler/` | todo |
| 24 | 手写 JSON decode validation | `standard-library/json_decode_validation/` | todo |
| 25 | 手写 io.Reader / io.Writer adapter | `standard-library/io_reader_writer/` | todo |
| 26 | 手写 middleware chain | `engineering-patterns/middleware_chain/` | todo |
| 27 | 手写 retry with backoff | `engineering-patterns/retry_with_backoff/` | todo |
| 28 | 手写 token bucket rate limiter | `engineering-patterns/token_bucket_rate_limiter/` | todo |
| 29 | 手写 in-memory repository | `engineering-patterns/in_memory_repository/` | todo |
| 30 | 手写 event bus | `engineering-patterns/event_bus/` | todo |
| 31 | 手写 config loader | `engineering-patterns/config_loader/` | todo |
| 32 | 手写 structured logger adapter | `engineering-patterns/structured_logger/` | todo |
| 33 | 手写 mini router | `mini-runtime/mini_router/` | todo |
| 34 | 手写 mini task queue | `mini-runtime/mini_task_queue/` | todo |
| 35 | 手写 mini scheduler | `mini-runtime/mini_scheduler/` | todo |
| 36 | 手写 mini cache with TTL | `mini-runtime/mini_cache_ttl/` | todo |
| 37 | 手写 mini pubsub | `mini-runtime/mini_pubsub/` | todo |
| 38 | 手写 mini agent tool runner | `mini-runtime/mini_agent_tool_runner/` | todo |
| 39 | 手写 SSE server | `mini-runtime/sse_server/` | todo |
| 40 | 手写 health check + metrics endpoint | `mini-runtime/health_check_metrics/` | todo |

---

## 面试主轴

| 主轴 | 必须能讲清楚的问题 | 对应 Part I 章节 |
|------|------------------|----------------|
| 内存模型 | slice 扩容、map 并发风险、逃逸分析、GC 基本行为 | 02、03 |
| 接口模型 | interface 动态类型、nil interface、method set、embedding | 02 |
| 并发模型 | goroutine 调度、channel 关闭原则、select、公平性、泄漏 | 03、04 |
| 取消模型 | context 传播、timeout、deadline、request-scoped value | 04、05 |
| 错误模型 | error wrapping、sentinel error、panic / recover 边界 | 02、07 |
| 工程模型 | middleware、graceful shutdown、测试、benchmark、race detector | 05、06、07 |
| 编译模型 | 编译流程、内联、逃逸分析、模块版本选择 | 06 |

---

## 运行约定

### 训练场代码

```bash
cd <对应目录>
go test ./...
go test -race ./...
go test -bench=. ./...
```

### 理论验证

```bash
# 逃逸分析
go build -gcflags="-m -m" ./...

# 竞态检测
go test -race ./...

# 性能分析
go test -cpuprofile=cpu.prof -bench=.
go tool pprof -http=:8080 cpu.prof
```

---

## 状态说明

| 标记 | 含义 |
|------|------|
| `seed` | 已建立目录与架构框架 |
| `todo` | 待补充代码实现或详细内容 |
| `done` | 已完成并可运行验证 |

当前状态：
- **Part I 理论体系**：8 个模块架构已建立，待逐层深化内容
- **Part II 训练场**：目录与题单已建立，待逐一实现代码与测试
