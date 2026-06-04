# Backend Patterns

这里沉淀具体后端构件。它们是架构能力的积木，但不是终点。

## 构件

| 构件 | 状态 | 关键点 |
| --- | --- | --- |
| middleware chain | tested | 洋葱模型、横切逻辑。含 `compose` + `createTimedPipeline` + 12 组测试 |
| repository | todo | 数据访问边界 |
| unit of work | todo | commit / rollback |
| event bus | todo | 解耦和一致性 |
| dependency injection | todo | 构造和生命周期 |
| result / error model | todo | 显式错误表达 |
| specification | todo | 业务规则组合 |
| command handler | todo | 用例入口 |

