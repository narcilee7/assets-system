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

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| Runtime | `runtime/` | event loop、stream、buffer、worker、module |
| Frameworks | `frameworks/` | Express、Koa、NestJS、Fastify、Hono、Next API |
| API Design | `api-design/` | REST、GraphQL、RPC、BFF、错误模型 |
| ORM / Database | `orm-database/` | Prisma、TypeORM、Sequelize、Drizzle、Mongoose、Knex |
| Auth / Security | `auth-security/` | session、JWT、OAuth、CSRF、XSS、rate limit |
| Background Jobs | `background-jobs/` | BullMQ、Agenda、worker、retry、DLQ |
| Realtime | `realtime/` | WebSocket、SSE、Socket.IO、backpressure |
| Observability | `observability/` | pino、OpenTelemetry、metrics、trace |
| Testing | `testing/` | Jest、Vitest、Supertest、Testcontainers、contract |
| Performance | `performance/` | profiling、clinic、heap、cluster、worker_threads |
| Architecture | `architecture/` | BFF、gateway、modular monolith、microservice |
| Ecosystem | `ecosystem/` | npm、pnpm、monorepo、native addon、supply chain |
| Deploy / Platform | `deploy-platform/` | Docker、serverless、PM2、K8s、edge |
| AI Backend | `ai-backend/` | tool runtime、SSE、RAG API、eval service |
| Case Studies | `case-studies/` | 用 Node.js 实现完整后端案例 |

## 核心题单

| 优先级 | 资产 | 目录 | 状态 |
| --- | --- | --- | --- |
| P0 | event loop deep dive | `runtime/` | todo |
| P0 | stream pipeline | `runtime/` | todo |
| P0 | NestJS service blueprint | `frameworks/` | todo |
| P0 | Prisma transaction and migration | `orm-database/` | todo |
| P0 | Node.js API error model | `api-design/` | todo |
| P0 | BullMQ job architecture | `background-jobs/` | todo |
| P0 | SSE / WebSocket service | `realtime/` | todo |
| P0 | Node.js observability baseline | `observability/` | todo |
| P1 | Fastify performance service | `frameworks/` | todo |
| P1 | GraphQL BFF | `api-design/` | todo |
| P1 | OAuth + session architecture | `auth-security/` | todo |
| P1 | Node.js AI tool runtime | `ai-backend/` | todo |

## 架构师级追问

- Node.js 适合 CPU 密集任务吗？如何隔离？
- event loop 被阻塞如何定位？
- Stream 背压如何工作？
- NestJS、Fastify、Express 如何选？
- Prisma 和 TypeORM 的取舍是什么？
- 数据库事务、连接池和 serverless 有什么坑？
- 如何设计 Node.js BFF？
- 如何用 Node.js 实现 Agent streaming 和 tool runtime？

