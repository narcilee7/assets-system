# Mini Runtime

这一层把零散机制组合成框架级理解：手写 IoC、ORM、Stream、缓存。

## 必会概念

- IoC 容器的核心：Bean 定义 → 实例化 → 依赖注入 → 生命周期管理。
- ORM 的核心：对象 ↔ 关系映射、Session/EntityManager、延迟加载。
- Stream API 的核心：数据源、中间操作流水线、终止操作聚合。
- 缓存的核心：读写策略、过期策略、并发控制。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 手写 mini IoC | `mini-ioc/` | todo | Bean 定义、依赖注入、循环依赖 |
| 手写 mini ORM | `mini-orm/` | todo | 注解映射、CRUD、Session |
| 手写 mini Stream | `mini-stream/` | todo | 流水线、惰性计算、收集器 |
| 手写 mini WebFlux 路由 | `mini-webflux/` | todo | 路由注册、Handler、Mono/Flux |
| 手写 mini 缓存 | `mini-cache/` | todo | 读写、过期、LRU |
