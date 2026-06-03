# Architecture Styles

架构风格训练的是代码和依赖如何组织。重点不是背名词，而是理解边界和依赖方向。

## 风格对比

| 风格 | 适合场景 | 风险 |
| --- | --- | --- |
| Layered Architecture | CRUD 和中小型服务 | 业务逻辑容易散落 |
| Clean Architecture | 业务规则稳定、外部依赖多 | 结构成本较高 |
| Hexagonal Architecture | 需要隔离 DB、消息、外部 API | 抽象过度风险 |
| Modular Monolith | 单体内需要清晰模块边界 | 模块边界容易被绕开 |
| Microservices | 独立发布、团队边界清晰 | 分布式复杂度高 |
| Event-driven | 异步解耦、最终一致 | 调试和一致性复杂 |

## 资产

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| layered service blueprint | todo | controller / service / repository |
| hexagonal service blueprint | todo | port / adapter / use case |
| modular monolith checklist | todo | 模块边界和依赖规则 |
| microservice split worksheet | todo | 拆分依据和反例 |

## 追问

- 这个系统应该先单体还是微服务？
- 依赖方向怎么保证？
- 什么时候抽象 Repository 是收益，什么时候是负担？

