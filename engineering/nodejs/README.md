# Node.js Architecture

Node.js 能力目标是精通级：理解运行时和事件循环，能用 Node.js 设计可靠后端服务，掌握主流框架、ORM、任务队列、实时通信、可观测、部署和生态治理。

## 能力模型

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 Runtime | event loop、microtask、stream、buffer、module | 能解释性能和时序问题 |
| L2 Web Backend | HTTP、middleware、routing、validation、error model | 能写稳定 API 服务 |
| L3 Framework | Express、Koa、NestJS、Fastify、Next API | 能根据场景选型和落地 |
| L4 Data Layer | Prisma、TypeORM、Sequelize、Drizzle、Mongoose | 能设计事务、迁移和性能 |
| L5 Production | auth、安全、日志、监控、任务、部署、灰度 | 能上线和运营服务 |
| L6 Platform / AI Backend | BFF、gateway、tool runtime、streaming、workflow | 能支撑复杂全栈和 AI 应用 |
| L7 Distributed Systems | 分布式通信、事务、一致性、幂等、锁、ID | 能设计高可用分布式架构 |
| L8 CLI / TUI / Agent Interface | 命令行、终端 UI、AI Agent CLI、REPL、PTY | 能构建人机交互界面 |

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| Runtime | `runtime/` | event loop、stream、buffer、worker、module |
| Frameworks | `frameworks/` | Express、Koa、NestJS、Fastify、Hono、Next API |
| API Design | `api-design/` | REST、GraphQL、RPC、BFF、错误模型 |
| ORM / Database | `orm-database/` | Prisma、TypeORM、Sequelize、Drizzle、Mongoose、Knex、MongoDB 高级特性 |
| Auth / Security | `auth-security/` | session、JWT、OAuth、CSRF、XSS、rate limit、password hashing |
| Background Jobs | `background-jobs/` | BullMQ、RabbitMQ、Kafka、NATS、Redis Streams、worker、retry、DLQ |
| Realtime | `realtime/` | WebSocket、SSE、Socket.IO、backpressure |
| Observability | `observability/` | pino、OpenTelemetry、metrics、trace |
| Testing | `testing/` | Jest、Vitest、Supertest、Testcontainers、contract |
| Performance | `performance/` | profiling、clinic、heap、cluster、worker_threads、caching |
| Architecture | `architecture/` | BFF、gateway、gRPC、微服务、分布式事务、Saga、CQRS、Event Sourcing |
| Ecosystem | `ecosystem/` | npm、pnpm、monorepo、native addon、supply chain |
| Deploy / Platform | `deploy-platform/` | Docker、serverless、PM2、K8s、CI/CD、edge |
| AI Backend | `ai-backend/` | tool runtime、SSE、RAG API、workflow、eval |
| CLI / TUI / Agent Interface | `cli-tui/` | CLI、TUI、AI Agent CLI、REPL、PTY、子进程 |
| Case Studies | `case-studies/` | 电商、聊天系统、任务调度 |

## 核心题单

| 优先级 | 资产 | 目录 | 状态 |
| --- | --- | --- | --- |
| P0 | event loop deep dive | `runtime/event-loop-lab/` | done |
| P0 | event loop bootstrap implementation | `runtime/event-loop-bootstrap/` | done |
| P0 | stream pipeline | `runtime/stream-pipeline/` | done |
| P0 | NestJS service blueprint | `frameworks/nestjs-blueprint/` | done |
| P0 | Fastify performance service | `frameworks/fastify-service/` | done |
| P0 | Prisma transaction and migration | `orm-database/prisma-transaction/` | done |
| P0 | Node.js API error model | `api-design/error-model/` | done |
| P0 | BullMQ job architecture | `background-jobs/bullmq-architecture/` | done |
| P0 | SSE / WebSocket service | `realtime/sse-server/`, `realtime/websocket-room/` | done |
| P0 | Node.js observability baseline | `observability/pino-logger/`, `observability/opentelemetry-baseline/` | done |
| P1 | Koa onion model | `frameworks/koa-onion/` | done |
| P1 | Hono edge runtime | `frameworks/hono-edge/` | done |
| P1 | Next.js API Routes | `frameworks/nextjs-api-routes/` | done |
| P1 | GraphQL BFF | `api-design/graphql-bff/` | done |
| P1 | tRPC router | `api-design/trpc-router/` | done |
| P1 | TypeORM repository | `orm-database/typeorm-example/` | done |
| P1 | Drizzle query builder | `orm-database/drizzle-example/` | done |
| P1 | Mongoose ODM | `orm-database/mongoose-example/` | done |
| P1 | Knex query builder | `orm-database/knex-example/` | done |
| P1 | MongoDB aggregation | `orm-database/mongodb-advanced/aggregation/` | done |
| P1 | MongoDB indexing | `orm-database/mongodb-advanced/indexing/` | done |
| P1 | MongoDB Change Streams | `orm-database/mongodb-advanced/change-streams/` | done |
| P1 | MongoDB transactions | `orm-database/mongodb-advanced/transactions/` | done |
| P1 | OAuth + session architecture | `auth-security/oauth-session/` | done |
| P1 | JWT complete implementation | `auth-security/jwt-implementation/` | done |
| P1 | CSRF & XSS protection | `auth-security/csrf-xss-protection/` | done |
| P1 | Password hashing | `auth-security/password-hashing/` | done |
| P1 | Monorepo with pnpm | `ecosystem/monorepo/` | done |
| P1 | Kubernetes deployment | `deploy-platform/k8s/` | done |
| P1 | CI/CD with GitHub Actions | `deploy-platform/github-actions/` | done |
| P1 | RabbitMQ architecture | `background-jobs/rabbitmq-architecture/` | done |
| P1 | Kafka streams | `background-jobs/kafka-streams/` | done |
| P1 | NATS messaging | `background-jobs/nats-messaging/` | done |
| P1 | Redis Streams | `background-jobs/redis-streams/` | done |
| P1 | gRPC service | `architecture/grpc-service/` | done |
| P1 | Distributed transactions | `architecture/distributed-transactions/` | done |
| P1 | Saga pattern | `architecture/saga-pattern/` | done |
| P1 | Idempotency patterns | `architecture/idempotency-patterns/` | done |
| P1 | Circuit breaker | `architecture/resilience/circuit-breaker/` | done |
| P1 | Retry & bulkhead | `architecture/resilience/retry-bulkhead/` | done |
| P1 | Distributed lock | `architecture/distributed-basics/distributed-lock/` | done |
| P1 | Distributed ID | `architecture/distributed-basics/distributed-id/` | done |
| P1 | Service discovery | `architecture/distributed-basics/service-discovery/` | done |
| P1 | Event sourcing | `architecture/event-driven/event-sourcing/` | done |
| P1 | CQRS | `architecture/event-driven/cqrs/` | done |
| P1 | Outbox pattern | `architecture/event-driven/outbox-pattern/` | done |
| P1 | Node.js AI tool runtime | `ai-backend/tool-runtime/` | done |
| P1 | RAG API | `ai-backend/rag-api/` | done |
| P1 | Workflow API | `ai-backend/workflow-api/` | done |
| P1 | Eval API | `ai-backend/eval-api/` | done |
| P1 | Chat system case study | `case-studies/chat-system/` | done |
| P1 | Task scheduler case study | `case-studies/task-scheduler/` | done |
| P1 | Heap diagnosis | `performance/heap-diagnosis/` | done |
| P1 | Cluster mode | `performance/cluster-mode/` | done |
| P1 | Caching strategy | `performance/cache-strategy/` | done |
| P1 | CLI argument parser | `cli-tui/cli-design/argument-parser/` | done |
| P1 | Interactive prompts | `cli-tui/cli-design/interactive-prompt/` | done |
| P1 | Colored output | `cli-tui/cli-design/colored-output/` | done |
| P1 | Spinners & progress | `cli-tui/cli-design/spinners-progress/` | done |
| P1 | Ink React TUI | `cli-tui/tui-design/ink-react-terminal/` | done |
| P1 | Blessed terminal | `cli-tui/tui-design/blessed-terminal/` | done |
| P1 | AI streaming output | `cli-tui/ai-agent-cli/streaming-output/` | done |
| P1 | Tool rendering | `cli-tui/ai-agent-cli/tool-rendering/` | done |
| P1 | Multi-turn chat | `cli-tui/ai-agent-cli/multi-turn-chat/` | done |
| P1 | Context management | `cli-tui/ai-agent-cli/context-management/` | done |
| P1 | REPL design | `cli-tui/repl-design/` | done |
| P1 | Child process | `cli-tui/process-interaction/child-process/` | done |
| P1 | PTY terminal | `cli-tui/process-interaction/pty-terminal/` | done |

## 架构师级追问

- Node.js 适合 CPU 密集任务吗？如何隔离？
- event loop 被阻塞如何定位？
- Stream 背压如何工作？
- NestJS、Fastify、Express 如何选？
- Prisma 和 TypeORM 的取舍是什么？
- 数据库事务、连接池和 serverless 有什么坑？
- 如何设计 Node.js BFF？
- 如何用 Node.js 实现 Agent streaming 和 tool runtime？
- 如何设计支持百万连接的实时系统？
- 如何在 K8s 上实现 Node.js 的零停机部署？
- 分布式事务 2PC、TCC、Saga 怎么选？
- 如何保证消息消费的幂等性？
- 熔断、重试、舱壁如何组合使用？
- 如何从零实现一个 Event Loop？
- CLI 参数解析如何防止 shell 注入？
- TUI 框架 Ink 和 Blessed 如何选型？
- AI Agent CLI 的流式输出如何做到不闪烁？
- PTY 与 spawn 的本质区别是什么？
