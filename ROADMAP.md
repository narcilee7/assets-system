# Roadmap

这个路线图用于控制范围。仓库已经覆盖足够广，后续重点不是继续扩张，而是把少数焦点做成可运行、可测试、可复盘的资产。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| seed | 只有方向、目录或索引 |
| draft | 有初版说明或代码 |
| tested | 有可运行实现和测试 |
| reviewed | 有边界、追问和工程复盘 |
| mastered | 能稳定迁移到面试和工程 |

## 阶段 0：体系治理

| 任务 | 目录 | 状态 | 完成标准 |
| --- | --- | --- | --- |
| 根入口收敛 | `README.md` | draft | 能在 1 分钟内看懂主干和当前焦点 |
| 空目录治理 | 全仓库 | draft | 被索引引用的目录都有 README 或可追踪文件 |
| 系统设计模板落地 | `system-design/` | draft | P0 案例具备 `docs/*.md` 模板 |
| 路线图收敛 | `ROADMAP.md` | draft | P0 不超过 5 个焦点 |

## 阶段 1：当前焦点

| 优先级 | 资产 | 目录 | 状态 | 为什么现在做 |
| --- | --- | --- | --- | --- |
| P0 | Python asset standard | `language/python/` | tested | 现有测试可跑，最适合作为资产样板 |
| P0 | Backend architecture model | `engineering/backend/` | seed | 架构师主线核心，连接系统设计和 AI Backend |
| P0 | Frontend architecture model | `engineering/frontend/` | seed | 补齐 Framework、工程化、跨端和前端平台能力 |
| P0 | Systems engineering foundation | `systems-engineering/` | seed | 从 Web 工程扩展到系统工程师范畴 |
| P0 | AI model system map | `artificial-intelligence/` | seed | 建立 LLM、VLM、Post-training、推理和评估认知 |

## 阶段 2：资产化队列

| 优先级 | 资产 | 目录 | 状态 |
| --- | --- | --- | --- |
| P1 | CPromise | `language/typescript/cpromise/` | draft |
| P1 | Algorithm patterns | `algorithm/patterns/` | seed |
| P1 | File upload system design | `system-design/file-upload/` | draft |
| P1 | Mini Agent Runtime | `ai-fullstack/agent-runtime/` | seed |
| P1 | Tool Calling Runtime | `ai-fullstack/tool-calling/` | seed |
| P1 | Node.js Architecture | `engineering/nodejs/` | seed |
| P1 | Go Runtime / Concurrency | `language/go/` | seed |

## Backlog

| 主线 | 目录 | 说明 |
| --- | --- | --- |
| Language Runtime | `language/` | JS / TS / Python / Go 语言机制和手写资产 |
| Algorithms | `algorithm/` | 模式库、LeetCode、数据结构 |
| Engineering | `engineering/` | 前端、后端、Node.js、网络、存储、安全、测试、DevOps |
| Systems Engineering | `systems-engineering/` | OS、Linux、网络、数据库、分布式、云原生、SRE、性能 |
| System Design | `system-design/` | 缓存、队列、实时、认证、Agent 平台等案例 |
| Artificial Intelligence | `artificial-intelligence/` | ML、DL、Transformer、LLM、VLM、Post-training、Serving |
| AI Fullstack | `ai-fullstack/` | Agent、RAG、Tool Calling、Eval、Streaming UI |

## 推进规则

1. 每轮最多选择 1 个 P0 资产推进到下一状态。
2. 新增目录必须带 `README.md`，否则不算进入体系。
3. 被根 README 或主线 README 引用的目录必须可被 Git 追踪。
4. `seed -> draft` 必须补目标、范围、题单或案例模板。
5. `draft -> tested` 必须有可运行实现和验证命令。
6. `tested -> reviewed` 必须补复盘、边界、追问和工程迁移。
7. 不再无限增加 P0；新增高优先级前必须降级或完成一个旧 P0。

