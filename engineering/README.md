# Engineering Primitives

工程层训练的是“把语言能力变成可靠构件”的能力。它覆盖前端、后端、网络、并发、存储、可观测、安全、测试和交付。

## 主干

| 主线 | 目录 | 目标 |
| --- | --- | --- |
| Frontend | `frontend/` | 前端架构师能力：Framework、工程化、跨端、性能、平台化 |
| Backend | `backend/` | 架构师级后端能力：领域、边界、一致性、可靠性、平台化 |
| Node.js | `nodejs/` | Node.js 后端、BFF、ORM、实时、任务、AI Backend |
| Network | `network/` | HTTP、重试、取消、超时、幂等、上传下载 |
| Concurrency | `concurrency/` | 任务调度、限流、背压、锁、队列 |
| Storage | `storage/` | 缓存、索引、事务、数据一致性 |
| Observability | `observability/` | log、metric、trace、debuggability |
| Security | `security/` | auth、permission、CSRF、XSS、secret |
| Testing | `testing/` | 单测、集成测试、契约测试、回归测试 |
| DevOps | `devops/` | CI、构建、部署、配置、回滚 |

## 构件资产模板

每个工程构件至少回答：

```text
解决什么工程问题？
API 怎么设计？
失败路径是什么？
如何测试？
如何观测？
如何扩展？
```

## 核心构件清单

| 优先级 | 构件 | 目录 | 状态 |
| --- | --- | --- | --- |
| P0 | request client | `network/patterns/` | todo |
| P0 | retry / timeout / cancellation | `network/patterns/` | todo |
| P0 | debounce / throttle | `frontend/patterns/` | draft |
| P0 | frontend architecture model | `frontend/` | todo |
| P0 | frontend engineering blueprint | `frontend/frontend-engineering/` | todo |
| P0 | framework deep dive | `frontend/frameworks/` | todo |
| P0 | cross-platform architecture | `frontend/cross-platform/` | todo |
| P0 | Node.js architecture model | `nodejs/` | todo |
| P0 | Node.js ORM ecosystem | `nodejs/orm-database/` | todo |
| P0 | middleware chain | `backend/patterns/` | todo |
| P0 | worker pool / bounded queue | `concurrency/patterns/` | todo |
| P0 | backend architecture model | `backend/` | todo |
| P0 | transaction boundary playbook | `backend/data-consistency/` | todo |
| P0 | service observability baseline | `backend/observability/` | todo |
| P0 | AI backend runtime | `backend/ai-backend/` | todo |
| P1 | cache with TTL | `storage/patterns/` | todo |
| P1 | event bus | `backend/patterns/` | todo |
| P1 | rate limiter | `concurrency/patterns/` | todo |
| P1 | structured logger | `observability/patterns/` | todo |
| P1 | auth guard | `security/patterns/` | todo |
| P1 | micro frontend decision framework | `frontend/micro-frontend/` | todo |
| P1 | Node.js realtime service | `nodejs/realtime/` | todo |
| P1 | Node.js background jobs | `nodejs/background-jobs/` | todo |
| P2 | contract test harness | `testing/patterns/` | todo |
| P2 | CI quality gate | `devops/patterns/` | todo |

## 训练路线

```text
小工具函数
-> 可测试构件
-> 有失败路径的构件
-> 有观测能力的构件
-> 可组合的小系统
```
