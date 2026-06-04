# Python 工程实践与设计

这一层讲「如何用 Python 写出可维护、可测试、高性能的生产代码」。

---

## 目录

| 文件 | 主题 |
|------|------|
| `project-structure.md` | 项目布局、src 布局 vs flat 布局 |
| `fastapi-and-pydantic.md` | 类型驱动的 Web API、依赖注入、中间件 |
| `testing-pyramid.md` | 单元测试、集成测试、pytest、fixtures、monkeypatch |
| `ddd-and-events.md` | 分层架构、DDD、领域事件、Event Bus |
| `observability.md` | 结构化日志、Metrics、Tracing、OpenTelemetry |

---

## 核心问题

1. FastAPI 如何利用 Python 类型提示生成 OpenAPI 文档？
2. Pydantic 的校验和序列化机制？
3. pytest 的 fixture 作用域和依赖注入？
4. 领域事件如何保证最终一致性？
5. 结构化日志 vs 纯文本日志的工程价值？

---

## 关联训练场

- `../engineering-patterns/` — Repository、UoW、Event Bus 实现
- `../mini-runtime/` — mini FastAPI、mini ORM
