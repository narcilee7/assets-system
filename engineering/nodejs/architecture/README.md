# Node.js Architecture

## 架构模式

| 模式 | 场景 |
| --- | --- |
| BFF | 前端聚合、权限、降级 |
| API Gateway | 路由、鉴权、限流 |
| Modular Monolith | 中小后端系统 |
| Microservice | 独立部署和团队边界 |
| Event-driven | 异步任务和最终一致 |
| Serverless | 低运维、突发流量 |
| gRPC | 高性能微服务通信 |
| CQRS | 读写分离、复杂查询 |
| Event Sourcing | 审计、状态重建 |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| Node.js BFF blueprint | `bff-blueprint/` | 服务聚合、降级中间件、缓存层 |
| API gateway with auth and rate limit | `api-gateway/` | Express + http-proxy-middleware + JWT + 限流 |
| modular NestJS architecture | *(见 `../frameworks/nestjs-blueprint`)* | 模块、分层、依赖注入 |
| gRPC service | `grpc-service/` | Protobuf、Unary/Streaming、Interceptor |
| Distributed transactions | `distributed-transactions/` | 2PC、TCC、CAP、一致性模型、本地消息表 |
| Saga pattern | `saga-pattern/` | 协调式/编排式 Saga、补偿、状态持久化 |
| Idempotency patterns | `idempotency-patterns/` | 幂等键、分布式锁、数据库唯一约束、滑动窗口 |
| Circuit breaker | `resilience/circuit-breaker/` | 三态熔断、opossum、降级策略 |
| Retry & bulkhead | `resilience/retry-bulkhead/` | 指数退避、抖动、舱壁隔离、p-retry |
| Distributed lock | `distributed-basics/distributed-lock/` | Redis SET NX EX、Redlock、看门狗续期 |
| Distributed ID | `distributed-basics/distributed-id/` | Snowflake、UUID v7、号段模式 |
| Service discovery | `distributed-basics/service-discovery/` | Consul、K8s DNS、Istio |
| Event sourcing | `event-driven/event-sourcing/` | Aggregate、Event Store、Projection、快照 |
| CQRS | `event-driven/cqrs/` | Command/Query 分离、最终一致性、物化视图 |
| Outbox pattern | `event-driven/outbox-pattern/` | 原子性消息、Message Relay、有序性保证 |
