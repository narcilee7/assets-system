# Go Architecture

Go 能力目标是精通级：理解 GMP 调度模型和并发原语，能用 Go 设计高可靠、高吞吐后端服务，掌握标准库、主流框架、ORM、消息队列、可观测性和部署体系。

## 能力模型

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 Runtime | goroutine、channel、GMP、context、sync | 能解释调度原理和竞态问题 |
| L2 Web Backend | HTTP、middleware、routing、validation | 能写稳定 API 服务 |
| L3 Framework | Gin、Echo、Fiber、stdlib net/http | 能根据场景选型和落地 |
| L4 Data Layer | GORM、Ent、sqlx、database/sql | 能设计事务、迁移和性能 |
| L5 Production | auth、安全、日志、监控、任务、部署 | 能上线和运营服务 |
| L6 Platform / AI Backend | BFF、gateway、gRPC、streaming、workflow | 能支撑复杂全栈和 AI 应用 |
| L7 Distributed Systems | 分布式通信、事务、一致性、幂等、锁、ID | 能设计高可用分布式架构 |

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| Runtime | `runtime/` | goroutine、channel、GMP、context、sync、atomic |
| Frameworks | `frameworks/` | Gin、Echo、Fiber、stdlib net/http |
| API Design | `api-design/` | REST、gRPC、错误模型、验证 |
| ORM / Database | `orm-database/` | GORM、Ent、sqlx、database/sql |
| Auth / Security | `auth-security/` | JWT、OAuth、密码哈希、RBAC |
| Background Jobs | `background-jobs/` | Asynq、Temporal、Go Workers |
| Realtime | `realtime/` | WebSocket、SSE |
| Observability | `observability/` | Zap、OpenTelemetry、Prometheus |
| Testing | `testing/` | testing、testify、gomock、httptest |
| Performance | `performance/` | pprof、race、benchmark、GC 调优 |
| Architecture | `architecture/` | BFF、gateway、gRPC、分布式事务、Saga、锁、ID |
| Ecosystem | `ecosystem/` | Go Modules、Workspace、CGO |
| Deploy / Platform | `deploy-platform/` | Docker、systemd、K8s |
| AI Backend | `ai-backend/` | streaming、tool runtime、RAG |
| CLI / TUI | `cli-tui/` | Cobra、Bubble Tea、PTY |
| Case Studies | `case-studies/` | 微服务后端、实时聊天 |

## 资产索引

### Runtime
- `runtime/goroutine-channel/` — goroutine + channel 基础与高级模式
- `runtime/gmp-model/` — GMP 调度器模型详解
- `runtime/context-sync/` — context.Context 与 sync 原语

### Frameworks
- `frameworks/gin-service/` — Gin 服务蓝图（中间件、验证、路由组）
- `frameworks/echo-fiber/` — Echo 与 Fiber 框架选型对比
- `frameworks/stdlib-http/` — 标准库 net/http 构建服务

### API Design
- `api-design/rest-error/` — RESTful 设计规范与错误模型
- `api-design/validation/` — 请求验证与中间件模式

### ORM / Database
- `orm-database/gorm-example/` — GORM 完整示例（CRUD、事务、Hook、迁移）
- `orm-database/ent-example/` — Ent 框架（Facebook 类型安全 ORM）
- `orm-database/sqlx-example/` — sqlx + database/sql 原语

### Auth / Security
- `auth-security/jwt-oauth/` — JWT 认证与 OAuth2 实现
- `auth-security/password-hashing/` — bcrypt/argon2 密码哈希

### Background Jobs
- `background-jobs/asynq-redis/` — Asynq 基于 Redis 的任务队列
- `background-jobs/temporal-go/` — Temporal 工作流引擎

### Realtime
- `realtime/gorilla-websocket/` — WebSocket 聊天服务
- `realtime/sse-server/` — SSE 事件流服务器

### Observability
- `observability/zap-logger/` — Zap 结构化日志
- `observability/opentelemetry/` — OpenTelemetry 链路追踪与指标

### Testing
- `testing/unit-test/` — testing + testify 单元测试
- `testing/httptest-mock/` — httptest + gomock 接口测试

### Performance
- `performance/pprof-benchmark/` — pprof 分析与基准测试
- `performance/race-detector/` — Race Detector 竞态检测

### Architecture
- `architecture/bff-gateway/` — BFF 聚合层设计
- `architecture/grpc-service/` — gRPC 服务与 Protobuf
- `architecture/distributed-transactions/` — 分布式事务（TCC/Saga）
- `architecture/saga-pattern/` — Saga 模式实现
- `architecture/distributed-lock/` — Redis 分布式锁
- `architecture/distributed-id/` — 分布式 ID 生成器

### Ecosystem
- `ecosystem/go-modules/` — Go Modules 依赖管理
- `ecosystem/workspace-cgo/` — Workspace 与 CGO 跨平台编译

### Deploy / Platform
- `deploy-platform/docker/` — Docker 多阶段构建与 distroless
- `deploy-platform/systemd/` — systemd 服务配置与优雅关闭
- `deploy-platform/k8s/` — Kubernetes Deployment 配置

### AI Backend
- `ai-backend/streaming-gateway/` — SSE 流式输出与 OpenAI API 调用
- `ai-backend/tool-runtime/` — 类型安全的 Tool Registry 实现
- `ai-backend/rag-api/` — RAG 检索增强生成架构

### CLI / TUI
- `cli-tui/cobra-cli/` — Cobra 命令行框架
- `cli-tui/bubbletea-tui/` — Bubble Tea TUI 框架
- `cli-tui/pty-terminal/` — PTY 伪终端交互

### Case Studies
- `case-studies/microservice-backend/` — 微服务后端分层架构案例
- `case-studies/realtime-chat/` — 实时聊天系统案例
