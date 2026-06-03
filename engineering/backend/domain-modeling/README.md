# Domain Modeling

领域建模训练的是把业务复杂度转成可维护模型的能力。架构师需要先看懂业务边界，再谈技术方案。

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Entity | 有身份和生命周期的对象 |
| Value Object | 无身份、靠值相等的对象 |
| Aggregate | 一致性边界 |
| Repository | 聚合持久化边界 |
| Domain Service | 不适合放在实体里的领域行为 |
| Domain Event | 领域内已经发生的事实 |
| Use Case | 应用层业务流程编排 |

## 题单

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| order domain model | todo | 订单、支付、库存、取消 |
| file upload domain model | todo | 文件、分片、合并、秒传 |
| agent session domain model | todo | 会话、计划、工具调用、事件 |
| permission domain model | todo | 用户、角色、资源、动作 |

## 追问

- 哪些对象需要身份？
- 聚合边界为什么这么切？
- 哪些不变量必须强一致？
- 领域事件是事实还是命令？

