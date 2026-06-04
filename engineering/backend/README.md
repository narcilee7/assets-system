# Backend Architecture

后端能力目标是架构师水平：能从业务问题出发，定义边界、设计接口、选择数据模型、处理一致性和失败路径，并能让系统可演进、可观测、可治理。

它不是只会写 CRUD、middleware、repository，而是能把代码构件组织成长期可维护的系统。

## 架构师能力模型

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 Code Primitive | 写出可靠函数、模块、错误处理、测试 | 单个模块正确、可测试 |
| L2 Service Boundary | 定义 API、DTO、Repository、事务边界 | 一个服务职责清晰 |
| L3 Domain Architecture | 领域建模、聚合、用例、领域事件 | 业务复杂度可控 |
| L4 Distributed Architecture | 一致性、消息、缓存、幂等、限流、容错 | 多服务协作可靠 |
| L5 Platform Architecture | 可观测、治理、发布、成本、SLO、演进 | 系统长期可运营 |
| L6 AI Backend Architecture | Agent runtime、tool runtime、RAG、eval、权限 | AI 应用可控、可评估 |

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| Domain Modeling | `domain-modeling/` | 领域、实体、值对象、聚合、用例、领域事件 |
| Architecture Styles | `architecture-styles/` | 分层、Clean Architecture、Hexagonal、DDD、微服务 |
| API Design | `api-design/` | REST、RPC、GraphQL、Event Contract、版本演进 |
| Data Consistency | `data-consistency/` | 事务、幂等、Outbox、Saga、最终一致 |
| Distributed Systems | `distributed-systems/` | CAP、复制、分片、锁、Leader、消息语义 |
| Reliability | `reliability/` | timeout、retry、circuit breaker、bulkhead、graceful degradation |
| Scalability | `scalability/` | 容量评估、缓存、异步化、读写分离、热点治理 |
| Security | `security/` | 认证、授权、租户隔离、审计、数据边界 |
| Observability | `observability/` | log、metric、trace、SLO、debuggability |
| Platform Engineering | `platform-engineering/` | CI/CD、配置、发布、回滚、治理 |
| AI Backend | `ai-backend/` | Agent、Tool、RAG、Eval、Streaming、Safety |
| Patterns | `patterns/` | middleware、repository、UoW、event bus 等构件 |
| Case Studies | `case-studies/` | 用真实案例串联架构能力 |

## 核心追问

架构师级后端每个设计都要能回答：

```text
业务边界是什么？
同步还是异步，为什么？
事务边界在哪里？
失败后如何恢复？
如何保证幂等？
如何观测和报警？
数据量扩大 10 倍怎么办？
如何灰度、回滚和演进？
安全边界和权限在哪里？
成本和复杂度是否值得？
```

## 核心资产清单

| 优先级 | 资产 | 目录 | 状态 |
| --- | --- | --- | --- |
| P0 | middleware pipeline | `patterns/middleware-pipeline/` | tested |
| P0 | retry / timeout / circuit breaker | `reliability/stability-patterns/` | tested |
| P0 | transaction boundary + idempotency | `data-consistency/transaction-boundary/` | tested |
| P0 | service observability baseline | `observability/observability-baseline/` | tested |
| P1 | layered service blueprint | `architecture-styles/` | todo |
| P1 | API design checklist | `api-design/` | todo |
| P1 | agent tool runtime backend | `ai-backend/` | todo |
| P1 | domain modeling kata | `domain-modeling/` | todo |
| P1 | outbox + event bus | `data-consistency/` | todo |
| P1 | capacity estimation worksheet | `scalability/` | todo |
| P1 | auth / permission model | `security/` | todo |
| P1 | release and rollback checklist | `platform-engineering/` | todo |

## 训练路径

```text
单体分层服务
-> 清晰领域边界
-> 事务和数据一致性
-> 异步事件和消息可靠性
-> 可观测和稳定性治理
-> 多服务系统设计
-> AI Backend Runtime
```

## 和其他主线的关系

- `language/go/`：后端并发、context、HTTP、服务端基础能力。
- `language/python/`：业务抽象、asyncio、Agent / API 快速实现。
- `system-design/`：把后端能力扩展成完整系统案例。
- `ai-fullstack/`：把后端架构能力用于 Agent、RAG、Eval 和 Tool Runtime。

