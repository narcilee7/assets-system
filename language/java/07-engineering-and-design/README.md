# Java 工程实践与设计模式

这一层讲「如何用 Java 写出可维护、可测试、高性能的生产代码」。

---

## 目录

| 文件 | 主题 |
|------|------|
| `spring-core.md` | IoC、AOP、Bean 生命周期、事务管理 |
| `design-patterns.md` | 23 种设计模式的 Java 实现与取舍 |
| `ddd-and-layered.md` | 分层架构、DDD 核心概念、领域事件 |
| `testing-and-mock.md` | JUnit、Mockito、集成测试、测试金字塔 |
| `observability.md` | 日志、Metrics、Tracing、Spring Boot Actuator |

---

## 核心问题

1. Spring IoC 容器如何解析循环依赖？
2. AOP 的 JDK 动态代理 vs CGLIB 区别？
3. 设计模式在 Java 中的典型应用（如 Spring 中的模板方法、策略模式）？
4. 单元测试 vs 集成测试的边界？
5. 可观测性三大支柱在 Java 服务中的落地？

---

## 关联训练场

- `../engineering-patterns/` — 设计模式手写实现
- `../mini-runtime/` — mini IoC、mini ORM
