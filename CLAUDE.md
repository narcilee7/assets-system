# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

这是一个**长期复利的面试/工程知识资产库**，面向 AI 全栈工程师、架构师与系统工程师。仓库不再按"我学过什么"组织，而是按"我能稳定解决什么层级的问题"组织。

每个目录的最终状态都必须是**可阅读、可实现、可测试、可复盘、可迁移**的资产。

## 仓库结构

按能力地图分 8 个主目录：

| 层级 | 目录 | 目标 |
| --- | --- | --- |
| Foundation | `language/` | JS / TS / Python / Go / Java 的运行时、类型、并发和手写能力 |
| Foundation | `algorithm/` | 数据结构、算法模式、LeetCode 高频题 |
| Systems | `systems-engineering/` | OS、Linux、网络、数据库、分布式、云原生、SRE、性能 |
| Engineering | `engineering/` | 前端、后端、Node.js/Go/Python 工程化、可靠性、平台化 |
| Architecture | `system-design/` | 以真实案例训练需求、接口、数据、一致性、扩展和失败路径 |
| Intelligence | `artificial-intelligence/` | ML、DL、Transformer、LLM、VLM、Post-training、推理、评估 |
| Product | `ai-fullstack/` | Agent、RAG、Tool Calling、Eval、Streaming UI |
| Career | `career-assets/` | 职业策略、沟通、领导力、面试体系 |

当前 P0 焦点见 `ROADMAP.md`（不超过 5 个，每轮只推进 1 个）。

## 资产模板（所有可测试资产通用）

每个资产目录必须包含 `README.md` + `impl.*` + `test.*` + `review.md` 四件套，模板见 `assets-template/README.md`。

`README.md` 必含：
- 目标 / 场景 / 核心考点 / 边界条件
- 实现思路（关键步骤，不是代码粘贴）
- 时间与空间复杂度
- 面试追问（数据量扩大 100 倍怎么办、并发安全、失败重试与恢复）
- 工程迁移（真实场景对应）

`review.md` 必含：
- 一开始容易写错什么
- 这个实现为什么成立
- 与标准库/框架实现的差距
- 工程里怎么取舍
- 下次复习重点

## 语言目录的统一结构

`language/<lang>/` 一律采用双层架构（详见 `language/README.md`）：

```
Part I — 理论体系
  01-language-philosophy
  02-type-system-theory
  03-compiler-and-runtime（或 03-jvm-and-runtime / 03-memory-and-runtime / 03-interpreter-and-runtime）
  04-module-system（JS/TS/Go 重点）
  04-concurrency-in-depth（Python/Go/Java）
  05-standard-library
  06-compiler-and-build
  07-engineering-and-design
  08-advanced-topics

Part II — 动手训练场
  runtime-model / core-abstractions / type-system-gymnastics /
  concurrency / standard-library / engineering-patterns /
  mini-runtime / tests
```

横向对照专题（异步模型、对象模型、错误处理、资源管理等）见 `language/README.md` 的对照表。

## 测试与运行命令

### 后端工程资产（TypeScript，`engineering/backend/`）

这是目前唯一带可运行测试的目录。`package.json` 已就位：

```bash
cd engineering/backend
npm install                       # 首次：安装 tsx + @types/node
npm test                          # 跑全部 *.test.ts（Node 内置 test runner + tsx loader）
node --test --import tsx <path>   # 跑单个测试，例如：
node --test --import tsx patterns/middleware-pipeline/middleware-pipeline.test.ts
node --test --import tsx data-consistency/transaction-boundary/transaction-boundary.test.ts
```

`npm test` 实际命令：

```
node --test --import tsx $(find . -name '*.test.ts' -not -path './node_modules/*')
```

约定：所有 `.test.ts` 与 `impl.ts` 同目录；模块类型 `"module"` + tsx 加载；测试用 `node:test` + `node:assert`。

### Rust 工程资产（`engineering/rust/`）

Cargo workspace 组织，所有资产通过 `cargo test --workspace` 跑：

```bash
cd engineering/rust
cargo build --workspace         # 编译全部 crate
cargo test --workspace          # 跑全部测试
cargo test -p <crate-name>      # 单 crate 测试
cargo bench --workspace         # criterion 基准
```

约定：每个资产是一个独立 crate，路径 `engineering/rust/crates/<name>/`，并在根 `Cargo.toml` 的 `[workspace] members` 中注册。`Cargo.lock` 当前在 `.gitignore`（workspace 只有占位 crate、暂无可发布产物）；等出现对外可发布 crate 时把它移出 `.gitignore` 并提交。

### 其他目录

`language/`、`algorithm/`、`system-design/`、`ai-fullstack/`、`career-assets/`、`systems-engineering/`、`artificial-intelligence/` 目前主要是文档 + 草稿代码，没有统一测试入口；新增可运行资产时请参考 `engineering/backend/` 或 `engineering/rust/` 的目录布局，并就近放 `package.json` 或 `Cargo.toml`。

## 资产状态机

| 状态 | 含义 |
| --- | --- |
| seed | 只有目录和方向 |
| draft | 有初版说明或代码 |
| tested | 有可运行实现和测试 |
| reviewed | 有边界、追问和工程复盘 |
| mastered | 能稳定迁移到面试和工程 |

推进规则（来自 `ROADMAP.md`）：

1. 每轮最多推进 1 个 P0 资产到下一状态。
2. 新增目录必须带 `README.md`。
3. `seed → draft`：补目标、范围、题单或案例模板。
4. `draft → tested`：有可运行实现 + 验证命令。
5. `tested → reviewed`：补复盘、边界、追问、工程迁移。
6. 不再无限增加 P0；新增前必须降级或完成一个旧 P0。

## 治理约束

- 被根 `README.md` 或主线 `README.md` 引用的目录必须可被 Git 追踪，且本身有 `README.md`。
- 所有 `node_modules` 一律 `.gitignore`（已在根 `.gitignore`）。
- 路径遵循 `<主线>/<子域>/<资产>/` 三层结构，资产目录下放 `README.md` + `impl.*` + `test.*` + `review.md`。

## 已落地的 tested 资产（参考实现）

| 资产 | 路径 |
| --- | --- |
| Middleware Pipeline（Koa 洋葱模型） | `engineering/backend/patterns/middleware-pipeline/` |
| Transaction Boundary + Idempotency Key | `engineering/backend/data-consistency/transaction-boundary/` |
| Stability Patterns（retry / timeout / circuit breaker） | `engineering/backend/reliability/stability-patterns/` |
| Service Observability Baseline | `engineering/backend/observability/observability-baseline/` |
| Layered Service Blueprint | `engineering/backend/architecture-styles/layered-service-blueprint/` |
| Outbox / Saga 模式 | `engineering/backend/data-consistency/{outbox-pattern,saga-pattern}/` |
| RBAC Model | `engineering/backend/security/rbac-model/` |

新建可运行资产时，**优先参考 `engineering/backend/patterns/middleware-pipeline/` 与 `engineering/backend/data-consistency/transaction-boundary/` 的文件结构与测试风格**。

## Rust 资产约定

- `engineering/rust/`：Cargo workspace + `crates/<name>/` 平铺，每个资产一个 crate，统一 `cargo test --workspace`。
- `language/rust/`：纯文档与代码片段（不挂 Cargo），Part I 理论 + Part II 训练场双层结构，与其他语言对齐。
- Rust 当前 `seed`：题单索引见 `engineering/rust/README.md` 与 `language/rust/README.md`，首个 `tested` 资产落地时再删除占位 `crates/seed`。