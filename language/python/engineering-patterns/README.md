# Engineering Patterns

这一层训练 Python 工程模式的实现：Repository、Unit of Work、Event Bus、DI Container。

## 必会概念

- Repository 抽象数据访问层，便于测试和切换存储实现。
- Unit of Work 管理事务边界，保证业务一致性。
- Event Bus 实现模块间解耦的事件驱动通信。
- DI Container 管理依赖关系，支持生命周期控制。

## 已有资产

| 资产 | 目录 | 状态 | 目标 |
|------|------|------|------|
| 工程模式 | `engineering-patterns/` | seed | Repository、UoW、Event Bus、DI |

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| Repository 模式 | `repository.py` | todo | 接口抽象、内存实现 |
| Unit of Work | `unit_of_work.py` | todo | 事务边界、提交/回滚 |
| Event Bus | `event_bus.py` | todo | 发布订阅、事件路由 |
| DI Container | `di_container.py` | todo | 依赖解析、生命周期 |
