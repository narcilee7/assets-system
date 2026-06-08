# Python Architecture

Python 能力目标是精通级：理解 GIL、asyncio 和并发模型，能用 Python/FastAPI 设计高可靠后端服务，掌握主流框架、ORM、消息队列、可观测性和部署体系。

## 能力模型

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 Runtime | GIL、asyncio、event loop、multiprocessing、threading | 能解释并发模型和性能瓶颈 |
| L2 Web Backend | HTTP、middleware、routing、validation | 能写稳定 API 服务 |
| L3 Framework | FastAPI、Django、Flask、Starlette | 能根据场景选型和落地 |
| L4 Data Layer | SQLAlchemy、Django ORM、Prisma、Tortoise | 能设计事务、迁移和性能 |
| L5 Production | auth、安全、日志、监控、任务、部署 | 能上线和运营服务 |
| L6 Platform / AI Backend | BFF、gateway、gRPC、streaming、workflow、LangChain | 能支撑复杂全栈和 AI 应用 |
| L7 Distributed Systems | 分布式通信、事务、一致性、幂等、锁、ID | 能设计高可用分布式架构 |

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| Runtime | `runtime/` | GIL、asyncio、event loop、multiprocessing、threading |
| Frameworks | `frameworks/` | FastAPI、Django、Flask、Starlette |
| API Design | `api-design/` | REST、gRPC、错误模型、Pydantic 验证 |
| ORM / Database | `orm-database/` | SQLAlchemy、Django ORM、Prisma Python、Tortoise |
| Auth / Security | `auth-security/` | JWT、OAuth、密码哈希、RBAC |
| Background Jobs | `background-jobs/` | Celery、RQ、Huey、APScheduler |
| Realtime | `realtime/` | WebSocket、SSE、Socket.IO |
| Observability | `observability/` | Structlog、OpenTelemetry、Prometheus |
| Testing | `testing/` | pytest、unittest、httpx、factory_boy |
| Performance | `performance/` | cProfile、line_profiler、asyncio 优化、多进程 |
| Architecture | `architecture/` | BFF、gateway、gRPC、分布式事务、Saga、锁、ID |
| Ecosystem | `ecosystem/` | pip/poetry/uv/pdm、virtualenv、monorepo |
| Deploy / Platform | `deploy-platform/` | Docker、systemd、K8s、Serverless |
| AI Backend | `ai-backend/` | LangChain、FastAPI streaming、tool runtime、RAG |
| CLI / TUI | `cli-tui/` | Click、Typer、Rich TUI、Prompt Toolkit |
| Case Studies | `case-studies/` | FastAPI 后端、实时聊天 |

## 资产索引

### Runtime
- `runtime/gil-asyncio/` — GIL 与 asyncio 并发模型详解
- `runtime/event-loop/` — Python 事件循环原理
- `runtime/multiprocessing/` — multiprocessing 与 threading 对比

### Frameworks
- `frameworks/fastapi-service/` — FastAPI 服务蓝图（依赖注入、验证、异常处理）
- `frameworks/django-patterns/` — Django 设计模式与最佳实践
- `frameworks/flask-patterns/` — Flask 应用结构与扩展
- `frameworks/starlette/` — Starlette ASGI 框架

### API Design
- `api-design/rest-error/` — RESTful 设计规范与统一错误模型
- `api-design/pydantic-validation/` — Pydantic v2 验证与序列化

### ORM / Database
- `orm-database/sqlalchemy-example/` — SQLAlchemy 2.0 async ORM
- `orm-database/django-orm/` — Django ORM 查询优化
- `orm-database/prisma-python/` — Prisma Client Python
- `orm-database/tortoise-orm/` — Tortoise ORM（async）

### Auth / Security
- `auth-security/jwt-oauth/` — PyJWT 与 OAuth2 实现
- `auth-security/password-hashing/` — passlib 密码哈希

### Background Jobs
- `background-jobs/celery-redis/` — Celery + Redis 任务队列
- `background-jobs/rq-huey/` — RQ 与 Huey 轻量队列
- `background-jobs/apscheduler/` — APScheduler 定时任务

### Realtime
- `realtime/fastapi-websockets/` — FastAPI WebSocket 群聊服务
- `realtime/fastapi-sse/` — SSE 事件流与 AI 流式输出
- `realtime/socketio/` — Socket.IO 实时通信

### Observability
- `observability/structlog/` — structlog 结构化日志
- `observability/opentelemetry/` — OpenTelemetry 链路追踪与指标

### Testing
- `testing/pytest-async/` — pytest + asyncio 测试与 factory_boy
- `testing/httpx-mock/` — httpx 异步接口测试与 Mock

### Performance
- `performance/cprofile/` — cProfile 性能分析
- `performance/line-profiler/` — line_profiler 逐行分析
- `performance/asyncio-perf/` — asyncio 优化与并发模型对比
- `performance/profiling/` — 综合性能优化指南（GIL、多进程）

### Architecture
- `architecture/bff-gateway/` — BFF 聚合层设计
- `architecture/grpc-service/` — gRPC 服务与 Protobuf
- `architecture/distributed-transactions/` — 分布式事务（TCC/Saga）
- `architecture/saga-pattern/` — Saga 模式实现
- `architecture/distributed-lock/` — Redis 分布式锁
- `architecture/distributed-id/` — 分布式 ID 生成器
- `architecture/distributed-patterns/` — 分布式设计模式汇总

### Ecosystem
- `ecosystem/pip-poetry-uv/` — pip/poetry/uv 包管理对比
- `ecosystem/virtualenv/` — virtualenv 虚拟环境
- `ecosystem/pip-venv/` — Poetry、uv 现代包管理
- `ecosystem/monorepo/` — Python 单体仓库实践

### Deploy / Platform
- `deploy-platform/docker/` — Docker 多阶段构建
- `deploy-platform/docker-uvicorn/` — Docker Compose + Uvicorn/Gunicorn
- `deploy-platform/systemd/` — systemd 服务部署
- `deploy-platform/k8s/` — Kubernetes 部署配置
- `deploy-platform/serverless/` — Serverless 部署（AWS Lambda / Vercel）

### AI Backend
- `ai-backend/fastapi-llm/` — FastAPI LLM Gateway（SSE 流式、Tool Runtime）
- `ai-backend/langchain-fastapi/` — LangChain + FastAPI 集成
- `ai-backend/streaming-gateway/` — 流式 AI 网关
- `ai-backend/tool-runtime/` — Tool Registry 实现
- `ai-backend/rag-api/` — RAG 检索增强生成

### CLI / TUI
- `cli-tui/click-typer/` — Click 与 Typer CLI 框架
- `cli-tui/rich-tui/` — Rich 终端 UI
- `cli-tui/prompt-toolkit/` — Prompt Toolkit 交互式 CLI

### Case Studies
- `case-studies/fastapi-backend/` — FastAPI 后端完整案例（SQLAlchemy 2.0、Celery、测试）
- `case-studies/realtime-chat/` — 实时聊天系统案例
