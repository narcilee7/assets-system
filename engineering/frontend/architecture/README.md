# 前端架构工程化

前端架构工程化训练 —— 达到"能设计应用架构、能组织状态管理、能规划模块边界"的水平。

## 训练哲学

1. **架构是约束也是自由**：好的架构限制错误的写法，引导正确的模式。
2. **分层是复杂度的克星**：每一层只做一件事，层与层之间通过明确接口通信。
3. **状态是万恶之源**：状态越多，bug 越多。架构的目标之一是减少不必要的状态。
4. **变化是永恒的**：架构必须支持演化，不能假设需求不变。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-frontend-architecture-patterns.md](01-frontend-architecture-patterns.md) | 前端架构模式：分层架构、MVC/MVVM、Clean Architecture、Feature-Based |
| [02-state-architecture.md](02-state-architecture.md) | 状态架构设计：全局 vs 局部、状态机、状态提升、反模式 |
| [03-component-architecture.md](03-component-architecture.md) | 组件架构：原子设计、复合组件、Headless UI、容器/展示分离 |
| [04-data-flow.md](04-data-flow.md) | 数据流架构：单向数据流、CQRS、Event Sourcing、命令模式 |
| [05-module-system.md](05-module-system.md) | 模块系统：依赖注入、控制反转、模块化策略、微内核架构 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/di-container.md](mini-impl/di-container.md) | 手写依赖注入容器 |
| [mini-impl/event-bus.md](mini-impl/event-bus.md) | 手写 Event Bus（发布订阅） |
| [mini-impl/state-machine.md](mini-impl/state-machine.md) | 手写有限状态机 |

## 架构选型决策树

```
应用规模？
  ├─ 小型（< 10 页面）→ 简单分层，无需过度设计
  ├─ 中型（10-50 页面）→ Feature-Based + 状态管理
  └─ 大型（> 50 页面）→ Clean Architecture + 微前端

状态复杂度？
  ├─ 低（表单为主）→ 局部状态 + Context
  ├─ 中（跨组件共享）→ 全局 Store（Redux/Zustand）
  └─ 高（复杂交互）→ 状态机 + Event Sourcing

团队协作规模？
  ├─ 小（< 5 人）→ 约定优于配置
  ├─ 中（5-20 人）→ 模块化 + 代码规范
  └─ 大（> 20 人）→ Monorepo + 独立部署单元
```
