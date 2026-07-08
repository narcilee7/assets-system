# Rust Engineering

Rust 工程层训练的是"用所有权 + 类型系统 + 零成本抽象做出可靠服务"的能力。它和 Go / Node.js / Python 工程化体系并列，但侧重点在：

- **内存安全** 由编译器保证，无需运行时 GC。
- **零成本抽象** 高级抽象不会带来性能税。
- **async/await 显式化** 通过 `Future` + `Pin` + `Waker` 把调度器变成可观察的运行时。
- **可组合错误模型** `Result<T, E>` + `?` 强制失败路径显式传播。
- **跨场景复用** 同一套资产既能写 Web 服务，也能写 CLI、嵌入式、WASM、FFI 桥。

## 能力模型

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 Runtime | 所有权/借用、生命周期、`Send`/`Sync`、`Future`、`Pin` | 能解释编译期保证和 unsafe 边界 |
| L2 Web Backend | HTTP、middleware、routing、validation、错误模型 | 能写稳定 API 服务 |
| L3 Framework | Axum、Actix-web、Rocket、`tower`/`hyper` | 能根据场景选型和落地 |
| L4 Data Layer | SQLx、Diesel、SeaORM、`tokio-postgres` | 能设计事务、迁移和性能 |
| L5 Production | auth、安全、日志、监控、任务、部署 | 能上线和运营服务 |
| L6 Platform / AI Backend | BFF、gateway、gRPC、streaming、tool runtime | 能支撑复杂全栈和 AI 应用 |
| L7 Distributed Systems | 通信、事务、一致性、幂等、锁、ID | 能设计高可用分布式架构 |
| L8 Systems & Edge | FFI、WASM、嵌入式、eBPF | 能跨语言、跨边界落地 |

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| Runtime | `runtime/` | 所有权/借用/生命周期、`Future` 模型、Tokio 调度、Pin、Safety |
| Frameworks | `frameworks/` | Axum、Actix-web、Rocket、`tower` middleware |
| API Design | `api-design/` | REST、gRPC（tonic）、错误模型、validation |
| ORM / Database | `orm-database/` | SQLx、Diesel、SeaORM、连接池、迁移 |
| Auth / Security | `auth-security/` | JWT、OAuth、密码哈希、RBAC、trait 抽象 |
| Background Jobs | `background-jobs/` | Tokio task、apalis、cron、Saga worker |
| Realtime | `realtime/` | WebSocket（axum / tokio-tungstenite）、SSE |
| Observability | `observability/` | `tracing`、`metrics`、OpenTelemetry |
| Testing | `testing/` | 单元、集成、proptest、criterion、mockall |
| Performance | `performance/` | `criterion` 基准、flamegraph、allocator 调优 |
| Architecture | `architecture/` | BFF、gateway、gRPC、分布式事务、锁、ID |
| Ecosystem | `ecosystem/` | Cargo workspace、特性标志、FFI（`unsafe`）、WASM |
| Deploy / Platform | `deploy-platform/` | Docker（distroless + scratch）、K8s、systemd、跨平台编译 |
| AI Backend | `ai-backend/` | 流式输出、Tool Registry、RAG、Eval harness |
| CLI / TUI | `cli-tui/` | clap、ratatui、crossterm、dialoguer |
| Case Studies | `case-studies/` | 微服务后端、实时聊天、AI Tool Runtime |

## 工具链

本目录使用 Cargo workspace 组织，所有资产通过 `cargo test` 统一运行。

```bash
cd engineering/rust
cargo build --workspace         # 编译所有 crate
cargo test --workspace          # 跑全部测试
cargo test -p <crate-name>      # 单 crate 测试
cargo bench --workspace         # criterion 基准
```

新增资产时，在 `crates/` 下新建一个 crate，并在根 `Cargo.toml` 的 `[workspace] members` 中加入。

## 资产索引

> 全部 `seed` 状态：每个能力域预留了目录，等首个 `tested` 资产落地。

### Runtime
- `runtime/ownership-borrow/` — 所有权/借用核心模式与边界
- `runtime/lifetimes/` — 生命周期标注、`'static`、HRTB
- `runtime/async-future/` — `Future` 手写、`Pin`、`Waker` 模型
- `runtime/tokio-runtime/` — Tokio 多线程/当前线程调度、task 取消
- `runtime/error-handling/` — `Result`/`?`/自定义错误类型、`anyhow` vs `thiserror`
- `runtime/unsafe-boundary/` — `unsafe` 封装、soundness 审计

### Frameworks
- `frameworks/axum-service/` — Axum 服务蓝图（handler、router、middleware、state）
- `frameworks/actix-service/` — Actix-web 服务蓝图
- `frameworks/tower-middleware/` — `tower::Service` 手写中间件（类比 Koa 洋葱模型）
- `frameworks/stdlib-http-hyper/` — `hyper` 底层 HTTP 服务

### API Design
- `api-design/rest-error/` — RESTful 设计 + `thiserror` 错误模型
- `api-design/grpc-tonic/` — tonic gRPC 服务
- `api-design/validation/` — 请求验证（`validator`、`garde`）

### ORM / Database
- `orm-database/sqlx-example/` — SQLx 原生 SQL + 编译期校验
- `orm-database/diesel-example/` — Diesel 强类型 schema
- `orm-database/seaorm-example/` — SeaORM 实体映射
- `orm-database/connection-pool/` — `deadpool`、`bb8`、连接池调优

### Auth / Security
- `auth-security/jwt-oauth/` — `jsonwebtoken` + OAuth2
- `auth-security/password-hashing/` — `argon2` / `bcrypt` / `scrypt`
- `auth-security/rbac-model/` — trait 抽象的 RBAC

### Background Jobs
- `background-jobs/tokio-task-pool/` — Tokio task 池 + backpressure
- `background-jobs/apalis-redis/` — apalis 基于 Redis 的任务队列
- `background-jobs/cron-scheduler/` — `tokio-cron-scheduler`

### Realtime
- `realtime/axum-websocket/` — Axum WebSocket 聊天
- `realtime/sse-stream/` — SSE 事件流（与 AI 流式输出结合）

### Observability
- `observability/tracing-subscriber/` — `tracing` 结构化日志 + span
- `observability/metrics-exporter/` — `metrics` + Prometheus exporter
- `observability/opentelemetry-otlp/` — OpenTelemetry OTLP 导出

### Testing
- `testing/unit-integration/` — 单元测试 + 集成测试分层
- `testing/property-based/` — `proptest` 属性测试
- `testing/mockall-traits/` — `mockall` 接口 mock
- `testing/criterion-bench/` — `criterion` 微基准

### Performance
- `performance/allocator-mimalloc/` — `mimalloc` / `jemalloc` 替换
- `performance/lto-codegen/` — LTO / codegen-units / PGO 调优
- `performance/simd-intrinsics/` — SIMD 内置函数

### Architecture
- `architecture/bff-gateway/` — BFF 聚合层（axum + tonic client）
- `architecture/grpc-microservice/` — gRPC 微服务
- `architecture/saga-outbox/` — Saga + Outbox 实现
- `architecture/distributed-lock/` — Redis 分布式锁
- `architecture/distributed-id/` — Snowflake / ULID / NanoID

### Ecosystem
- `ecosystem/cargo-workspace/` — Cargo workspace、特性标志
- `ecosystem/ffi-cbindgen/` — C-FFI + `cbindgen`
- `ecosystem/wasm-bindgen/` — WASM + `wasm-bindgen` 前端互操作
- `ecosystem/cross-compile/` — 跨平台交叉编译

### Deploy / Platform
- `deploy-platform/docker-distroless/` — 多阶段构建 + distroless / scratch
- `deploy-platform/k8s-deployment/` — K8s Deployment + 优雅关闭
- `deploy-platform/systemd/` — systemd unit + signal 处理

### AI Backend
- `ai-backend/streaming-llm/` — SSE 流式 LLM 响应
- `ai-backend/tool-registry/` — 类型安全 Tool Registry
- `ai-backend/rag-pipeline/` — RAG 检索增强生成

### CLI / TUI
- `cli-tui/clap-cli/` — `clap` 命令行框架
- `cli-tui/ratatui-tui/` — `ratatui` TUI
- `cli-tui/dialoguer-prompt/` — `dialoguer` 交互式 prompt

### Case Studies
- `case-studies/microservice-backend/` — 微服务后端分层案例
- `case-studies/realtime-ai-chat/` — AI 实时聊天系统

## 训练路线

```text
Runtime 机制（所有权、生命周期、async）
  -> 错误模型与 middleware（Result + tower）
  -> Web 服务蓝图（Axum + SQLx）
  -> 可观测与可靠性（tracing + 重试/熔断）
  -> 分布式与 AI Backend（gRPC + 流式 + Tool Runtime）
  -> 跨边界（WASM / FFI / 嵌入式）
```

## 与其他主线的关系

- `language/rust/`：Rust 语言机制和手写资产（所有权/借用/生命周期/`Future`）。
- `systems-engineering/`：低层 OS/网络；Rust 是把它落地为可运行代码的主要载体。
- `engineering/backend/`：架构师级一致性、可靠性、平台化；Rust 把这些实现成零成本版本。
- `ai-fullstack/`：AI Backend Runtime 的高可靠实现层。