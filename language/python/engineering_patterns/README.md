# 工程模式层

这一层训练真实后端里的边界感：事务边界、数据访问、事件传播、依赖管理、配置和错误表达。

## 必会概念

- Repository 隔离数据访问细节。
- Unit of Work 管理事务生命周期。
- Event Bus 解耦发布方和订阅方。
- DI Container 负责对象构造和依赖装配。
- Middleware 用统一入口处理横切逻辑。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| 手写 Repository | `repository.py` | todo | 存储抽象、接口边界 |
| 手写 Unit of Work | `unit_of_work.py` | todo | commit / rollback |
| 手写 Event Bus | `event_bus.py` | todo | handler 注册、同步 / 异步 |
| 手写 Middleware | `middleware.py` | todo | 洋葱模型 |
| 手写 DI Container | `di_container.py` | todo | provider、singleton、scope |
| 手写 Result / Either | `result.py` | todo | 显式错误建模 |
