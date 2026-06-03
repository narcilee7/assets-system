# Interview Assets

面向 AI 全栈工程师、架构师、系统工程师的长期复利知识资产库。

这个仓库不再按“我学过什么”组织，而是按“我能稳定解决什么层级的问题”组织。每个目录都必须最终沉淀为可阅读、可实现、可测试、可复盘、可迁移的资产。

## 能力地图

| 层级 | 主线 | 目录 | 目标 |
| --- | --- | --- | --- |
| Foundation | Language Runtime | `language/` | JS / TS / Python / Go 的运行时、类型、并发和手写能力 |
| Foundation | Algorithms | `algorithm/` | 数据结构、算法模式、LeetCode 高频题 |
| Systems | Systems Engineering | `systems-engineering/` | OS、Linux、网络、数据库、分布式、云原生、SRE、性能 |
| Engineering | Engineering Architecture | `engineering/` | 前端、后端、Node.js、工程化、可靠性、平台化 |
| Architecture | System Design | `system-design/` | 以真实案例训练需求、接口、数据、一致性、扩展和失败路径 |
| Intelligence | Artificial Intelligence | `artificial-intelligence/` | ML、DL、Transformer、LLM、VLM、Post-training、推理、评估 |
| Product | AI Fullstack | `ai-fullstack/` | Agent、RAG、Tool Calling、Eval、Streaming UI、AI 应用闭环 |
| Career | Career Assets | `career-assets/` | 职业策略、沟通、领导力、商业思维、面试体系、决策与谈判 |

## 当前焦点

当前只推进 5 个 P0 焦点，其他目录先作为体系骨架保留：

| 焦点 | 目录 | 目标 | 状态 |
| --- | --- | --- | --- |
| Python 资产样板 | `language/python/` | 用已通过测试的实现建立“实现 + 测试 + 复盘”标准 | tested |
| 后端架构师模型 | `engineering/backend/` | 领域、API、一致性、可靠性、可观测、AI Backend | seed |
| 前端架构师模型 | `engineering/frontend/` | Framework、工程化、跨端、微前端、AI Frontend | seed |
| 系统工程基础 | `systems-engineering/` | Linux、网络、数据库、分布式、Kubernetes、SRE、性能 | seed |
| AI 模型体系 | `artificial-intelligence/` | Transformer、LLM、VLM、Post-training、推理优化、评估 | seed |

完整路线与推进规则见 `ROADMAP.md`。

## 资产准入标准

一个知识点只有满足下面条件，才算进入“资产”状态：

1. 有 `README.md`，说明目标、场景、考点、边界和追问。
2. 有最小实现或可执行案例。
3. 有测试或验证方式。
4. 有 `review.md` 或等价复盘，说明复杂度、机制、工程取舍。
5. 能映射到面试表达或真实工程场景。

统一模板见 `assets-template/`。

## 资产模板

`assets-template/README.md` 定义了每个资产的标准文件结构与内容规范：

```text
README.md    # 目标、场景、考点、边界、思路、复杂度、追问、工程迁移
impl.*       # 可运行实现，优先边界处理，注释清晰
test.*       # 正常路径、边界路径、易错路径、时序与失败路径
review.md    # 易错点、实现原理、与标准库差距、工程取舍、复习重点
```

新建资产时应遵循此模板，确保一致性与可维护性。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| seed | 只有目录和方向 |
| draft | 有初版说明或代码 |
| tested | 有可运行实现和测试 |
| reviewed | 有边界、追问和工程复盘 |
| mastered | 能稳定迁移到面试和工程 |

## 训练顺序

这是推荐路径，不是唯一顺序：

```text
语言运行时
-> 算法与数据结构
-> 系统工程
-> 工程架构
-> 系统设计
-> AI 模型体系
-> AI 全栈应用
```
