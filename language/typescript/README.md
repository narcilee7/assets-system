# TypeScript

TypeScript 这条线训练类型建模、运行时边界和工程约束。它不是只写类型体操，而是让类型系统服务于真实模块、状态机和 API 合约。

## 能力层

| 层级 | 目录 | 内容 |
| --- | --- | --- |
| Type System | `type-system/` | union、generic、conditional type、mapped type、infer |
| Runtime Bridges | `runtime-bridges/` | schema、type guard、assertion、JSON 边界 |
| Engineering Patterns | `engineering-patterns/` | Result、Event、Command、Repository、DI 类型建模 |
| Mini Runtime | `cpromise/` | 手写 Promise 状态机和组合 API |

## 当前资产

| 资产 | 目录 | 状态 | 目标 |
| --- | --- | --- | --- |
| CPromise | `cpromise/` | draft | Promise 状态机、thenable 展开、组合 API、微任务 |

## 核心题单

| 优先级 | 资产 | 状态 | 目标 |
| --- | --- | --- | --- |
| P0 | CPromise | draft | 异步状态机 + 类型签名 |
| P0 | Result / Either | todo | 显式错误建模 |
| P0 | Type Guard + Assertion | todo | 运行时输入校验 |
| P1 | Event Map Emitter | todo | 类型安全事件系统 |
| P1 | API Response Modeling | todo | 前后端契约 |
| P1 | DeepReadonly / PickByValue / UnionToIntersection | todo | 类型变换能力 |
| P2 | DI Container Types | todo | 工程类型约束 |

## 下一步

- 在 `cpromise/` 补依赖安装和测试说明。
- 给 `type-system/` 增加类型题模板。
- 给 `runtime-bridges/` 增加 JSON parse + schema validate 资产。

