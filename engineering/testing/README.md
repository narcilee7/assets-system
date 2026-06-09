# 测试工程化

测试工程化训练 —— 达到"能设计分层测试策略、能构建自动化测试流水线、能处理 flaky 测试、能用测试驱动设计"的水平。

## 训练哲学

1. **测试是设计工具，不是事后检查**：TDD 让你写出更易测试的代码，更易测试的代码通常是更好的设计。
2. **测试金字塔仍然有效**：单元测试 70% + 集成测试 20% + E2E 测试 10%，倒置的金字塔是反模式。
3. **可信的测试才有价值**：一个偶尔失败的测试比一个没写的测试更糟 —— flaky 测试会摧毁团队对测试的信心。
4. **测试代码也是代码**：需要可读性、可维护性、DRY 原则（但 DAMP 优于 DRY）。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-testing-fundamentals.md](01-testing-fundamentals.md) | 测试基础：金字塔、TDD/BDD、测试分类、FIRST 原则 |
| [02-unit-testing.md](02-unit-testing.md) | 单元测试：框架、Mock/Stub、覆盖率、参数化测试 |
| [03-integration-testing.md](03-integration-testing.md) | 集成测试：数据库、API、测试容器、契约测试 |
| [04-e2e-testing.md](04-e2e-testing.md) | E2E 测试：Selenium/Cypress/Playwright、POM、视觉回归 |
| [05-performance-testing.md](05-performance-testing.md) | 性能测试：负载/压力/ soak、JMeter/k6、基准测试 |
| [06-test-automation-cicd.md](06-test-automation-cicd.md) | 测试自动化：CI/CD 集成、并行执行、flaky 处理 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/test-framework.md](mini-impl/test-framework.md) | 手写测试框架（Runner + Assertions + Hooks + Reporter） |
| [mini-impl/mock-library.md](mini-impl/mock-library.md) | 手写 Mock/Stub 库 |

## 测试决策树

```
测试什么？
  ├─ 单个函数/类 → 单元测试（最快、最频繁）
  ├─ 多个组件协作 → 集成测试（数据库/API/消息队列）
  ├─ 完整用户场景 → E2E 测试（最慢、最接近真实）
  └─ 性能指标 → 性能测试（吞吐量/延迟/稳定性）

Mock 还是真实依赖？
  ├─ 外部 HTTP API → Mock（避免依赖不稳定）
  ├─ 数据库 → 真实（内存数据库或测试容器）
  ├─ 文件系统 → 真实（临时目录）
  └─ 当前时间 → Mock（保证可重复）

测试失败？
  ├─ 总是失败 → 代码 bug，立即修复
  ├─ 从不失败 → 检查测试是否真的有断言
  └─ 偶尔失败 → flaky 测试，立即隔离修复
```
