# Production AI Agent 架构深度剖析：Claude Code、OpenClaw、Coze、Cursor

本文从工程架构视角拆解四款代表性 AI Agent 产品：Claude Code（云端 CLI 编程 Agent）、OpenClaw（开源本地优先通用 Agent）、Coze（低代码 Agent 平台）、Cursor（AI-first IDE）。重点分析它们的运行时、工具系统、上下文管理、流式交互、安全与可观测性，并提炼可复用的生产设计模式。

---

## 一、产品定位与核心差异

| 维度 | Claude Code | OpenClaw | Coze | Cursor |
| --- | --- | --- | --- | --- |
| 定位 | 企业级 CLI 编程助手 | 开源本地通用 Agent | 低代码 Agent 搭建平台 | AI-first 代码编辑器 |
| 形态 | CLI / TUI | CLI / Bot / 多通道 | Web IDE + 多平台发布 | Desktop IDE |
| 部署 | 云端模型 + 本地客户端 | 本地优先，可自托管 | 字节跳动云服务 | 本地客户端 + 云端模型 |
| 主要场景 | 代码理解、重构、调试、提交 | 自动化、 orchestration、vibe coding | 客服、社交机器人、工作流 | 代码编写、重构、问答 |
| 用户 | 专业开发者 | 开发者 / 高级用户 | 业务人员 + 开发者 | 开发者 |
| 开源 | 否 | 是 | 部分开源（Coze Studio / Loop） | 否 |
| 模型 | Claude 系列 | 可接 Ollama / vLLM / 本地模型 | GPT / Claude / Doubao 等 | GPT / Claude / Composer |

---

## 二、Claude Code 架构

### 2.1 总体架构

Claude Code 是一款基于终端的 AI 编程 Agent，客户端用 TypeScript + Bun + React Ink 构建，通过 Anthropic API 与云端 Claude 模型通信。2026 年 3 月的 source map 泄漏事件让其内部架构被社区详细研究。

```text
CLI / TUI (React Ink)
  → Agent Runtime (Single-threaded master loop "nO")
    → Tool Registry (40+ built-in tools)
    → Query Executor
    → Context Manager
    → Permission System
  → Anthropic API (Claude models)
  → Local Filesystem / Git / Shell
```

参考：[Claude Code Leak: A Deep Dive into Anthropic's AI Coding Agent Architecture](https://redreamality.com/blog/claude-code-source-leak-architecture-analysis/)、[Claude Code Agent Architecture - ZenML](https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding)

### 2.2 Agent Runtime：单线程主循环

Claude Code 的核心是一个单线程主循环（代号 nO），设计理念是**可调试性优于并行性**。

- **主循环**：每次迭代接收模型输出，决定是调用工具还是生成回复。
- **TODO-based planning**：模型生成待办列表，逐步完成。
- **Diff-based workflows**：代码修改通过 diff 应用，便于审查和回滚。
- **有限子 Agent**：必要时spawn 子 Agent 处理独立任务，但主循环保持控制。

**为什么选单线程？**
- 调试简单，事件顺序确定。
- 避免多 Agent 协作中的状态冲突。
- 对于编程任务，顺序执行通常足够。

**追问**：单线程会不会太慢？（Claude Code 通过工具级并行和模型 streaming 弥补；对代码任务，规划质量比并行更重要。）

### 2.3 工具系统

泄漏代码显示 Claude Code 集成了 **40+ 内置工具** 和 **39 个内部服务**。

工具分类：
- **文件工具**：read_file、write_file、edit_file、list_directory。
- **搜索工具**：grep、find、ast search。
- **执行工具**：bash、python。
- **Git 工具**：git_status、git_diff、git_commit。
- **MCP 工具**：通过 Model Context Protocol 接入外部工具。

权限模型：
- 工具按风险分级。
- 首次执行 bash 等高风险工具需要用户授权。
- 支持自动模式（--dangerous-auto-approve）用于 CI/ trusted 环境。

### 2.4 三层记忆架构

根据泄漏分析，Claude Code 采用了三层记忆：

1. **`memory.md`**：持久化记忆文件，记录跨 session 的用户偏好、项目约定。
2. **Grep-based search layer**：实时搜索当前代码库，获取最新上下文。
3. **Chyros daemon（未发布）**：后台组件，负责持续索引和背景任务。

参考：[What Is the Anthropic Claude Code Source Code Leak? Three-Layer Memory Architecture Explained](https://www.mindstudio.ai/blog/claude-code-source-leak-three-layer-memory-architecture)

### 2.5 上下文管理

- **Flat message history**：扁平消息历史，避免复杂嵌套。
- **Context compression**：长 session 时压缩旧消息。
- **AST-level security checks**：工具调用前做 AST 级别安全检查。

### 2.6 可借鉴的设计模式

- **单线程主循环 + 有限并发**：适合需要强一致性的编程任务。
- **Diff-based 编辑**：代码修改可审查、可回滚。
- **三层记忆**：持久文件 + 实时搜索 + 后台索引。
- **工具权限分级 + 自动模式**：平衡安全与效率。

---

## 三、OpenClaw 架构

### 3.1 总体架构

OpenClaw（前身为 Clawdbot / Moltbot）是一款开源、本地优先的通用 AI Agent。其核心特点是 **SOUL.md 配置驱动** 和 **多通道部署**。

```text
User Input (Telegram / Discord / Slack / CLI)
  → OpenClaw Gateway (24/7)
    → SOUL.md Config（身份、人格、边界）
    → Skill Library
    → Agent Runtime
      → Planner
      → Tool Executor
      → Memory Store
    → Local LLM (Ollama / vLLM / Qwen / Llama)
```

参考：[OpenClaw (Formerly Clawdbot & Moltbot) Explained](https://milvus.io/blog/openclaw-formerly-clawdbot-moltbot-explained-a-complete-guide-to-the-autonomous-ai-agent.md)、[OpenClaw Review: The Open-Source Local AI Agent](https://vibecoding.app/blog/openclaw-review)

### 3.2 SOUL.md：配置即人格

SOUL.md 是 OpenClaw 的核心配置文件，定义：
- Agent 身份和人格。
- 可用技能（skills）。
- 操作边界（能做什么、不能做什么）。
- 多通道行为差异。

这种 config-first 设计让非开发者也能部署和定制 Agent。

### 3.3 Skill 系统

OpenClaw 的能力来自 Skill Library：
- 每个 skill 是一个独立功能模块。
- 社区可贡献 skill，形成生态。
- Skill 可以调用工具、访问 API、操作文件。

这与 Claude Code 的固定内置工具不同：OpenClaw 更强调 **可扩展的 skill 生态**。

### 3.4 本地优先与隐私

- 默认使用本地模型（Ollama、vLLM、Qwen、Llama）。
- 数据不出本地，适合隐私敏感场景。
- 也可配置远程模型，但核心设计是 local-first。

### 3.5 多通道与持久化

- 支持 Telegram、Discord、Slack、CLI。
- Gateway 24/7 运行，维护持久 session。
- 有状态 Agent，可执行长期自动化任务。

### 3.6 可借鉴的设计模式

- **Config-first 人格定义**：SOUL.md 让 Agent 行为可配置、可版本化。
- **Skill 生态**：插件化能力扩展。
- **本地优先 + 可选云端**：满足隐私和可控需求。
- **多通道统一网关**：同一 Agent 可部署到多个交互界面。

---

## 四、Coze 架构

### 4.1 总体架构

Coze 是字节跳动推出的 AI Agent 开发平台，面向低代码/无代码用户，支持可视化搭建 Bot、插件、知识库、工作流，并一键发布到多个社交渠道。

```text
Coze Studio（Web IDE）
  → Bot Config（system prompt / model / tools / memory）
  → Knowledge Base（RAG）
  → Plugin System（60+ built-in + custom API）
  → Multi-Agent Workflow
  → Coze Loop（运营平台）
  → Channels（Discord / Telegram / Lark / WeChat / Doubao）
```

参考：[Coze Review: ByteDance's AI Agent Builder](https://aitoolsrecap.com/Reviews/coze-review)、[ByteDance Open-Sources AI Agent Platform 'Coze'](https://en.tmtpost.com/news/7641222)

### 4.2 Bot 配置模型

一个 Coze Bot 由以下部分组成：
- **System Prompt**：定义 Bot 身份和行为。
- **Model**：可选 GPT、Claude、Doubao 等。
- **Plugins**：工具能力，如搜索、图像生成、代码执行。
- **Knowledge Base**：基于 RAG 的私有知识。
- **Memory**：长期记忆和用户画像。
- **Workflow**：多步骤任务编排。

### 4.3 插件系统

- 60+ 内置插件覆盖搜索、图像、日历、代码等。
- 自定义插件通过 OpenAPI 规范接入。
- 插件是 Coze 的核心扩展机制，与 Bot 配置解耦。

### 4.4 知识库与 RAG

- 支持上传 PDF、TXT、URL。
- 自动 chunk 和 embedding。
- 检索结果用于回答，支持引用。

### 4.5 多 Agent 工作流

- 可视化拖拽构建多 Agent pipeline。
-  Specialist Agent 之间可传递任务。
- 适合客服、内容生成、数据分析等场景。

### 4.6 发布与运营

- 一键发布到多个社交平台。
- Coze Loop 提供运营分析、对话日志、效果评估。

### 4.7 可借鉴的设计模式

- **低代码可视化**：降低 Agent 开发门槛。
- **插件市场**：生态化扩展能力。
- **一键多渠道发布**：同一 Bot 多端运行。
- **Model + RAG + Memory + Workflow 一体化**：完整的 Agent 平台套件。

---

## 五、Cursor 架构

### 5.1 总体架构

Cursor 是由 Anysphere 开发的 AI-first 代码编辑器，基于 VSCode 分支构建，深度集成 AI 能力。Cursor 3 开始走向 **Unified Agent Workspace**，支持多 Agent 协作（Fleet）和本地/云端无缝迁移。

```text
Cursor IDE (Electron + VSCode fork)
  → Composer Model（Cursor 自研 frontier model）
  → Agent System
    → Ask Mode（问答）
    → Edit Mode（编辑）
    → Agent Mode（自动执行多步任务）
  → Fleet Sidebar（多 Agent 管理）
  → Context Engine（代码库索引）
  → Marketplace（插件生态）
```

参考：[Cursor 3 Unified Agent Workspace Architecture 2026](https://github.com/FreezeSoul/agent-engineering-by-openclaw/blob/master/articles/practices/ai-coding/cursor-3-unified-agent-workspace-architecture-2026.md)、[Beyond Cursor: From AI Editor to Agent Workspace](https://nimbalyst.com/blog/beyond-cursor-why-the-future-starts-with-the-agent)

### 5.2 基于 VSCode 分支的优势

- 兼容现有 VSCode 生态（extensions、themes、keybindings）。
- 降低用户迁移成本。
- 但也在逐步重构界面，走向 AI-native 体验。

### 5.3 三种模式

- **Ask Mode**：问答，参考当前文件或代码库。
- **Edit Mode**：Inline 编辑，生成 diff 让用户确认。
- **Agent Mode**：自动执行多步任务，如创建文件、运行命令、调试。

### 5.4 Composer 模型

Cursor 自研或深度定制的 frontier model，针对代码场景优化：
- 长上下文理解。
- 代码生成和重构。
- Agent 决策能力。

### 5.5 Context Engine

- 对整个代码库做语义索引。
- 支持 @file、@folder、@code 等上下文引用。
- 为模型提供精准的代码上下文。

### 5.6 Fleet：多 Agent 协作

Cursor 3 引入 Fleet 侧边栏，支持：
- 同时运行多个 Agent。
- 每个 Agent 负责不同任务（如一个写测试，一个改代码）。
- Agent 之间可共享上下文和状态。

### 5.7 可借鉴的设计模式

- **AI-native IDE**：从界面到交互都为 AI 协作设计。
- **Context Engine**：代码库级语义索引。
- **模式分层**：Ask / Edit / Agent 满足不同自动化程度。
- **多 Agent Workspace**：从单 Agent 到 Fleet 协作。

---

## 六、四大产品架构对比

### 6.1 Agent Runtime 对比

| 产品 | Planning | Execution | Concurrency | Recovery |
| --- | --- | --- | --- | --- |
| Claude Code | TODO-based + ReAct | 单线程主循环 | 有限子 Agent | Checkpoint + diff |
| OpenClaw | Config-driven + skill chain | 事件驱动 | 异步多任务 | Persistent session |
| Coze | Visual workflow + LLM | Workflow engine | 多 Agent pipeline | Step retry + checkpoint |
| Cursor | Agent mode plan | 命令执行 + diff | Fleet 多 Agent | Undo + git |

### 6.2 工具/插件系统对比

| 产品 | 工具形式 | 扩展性 | 权限控制 |
| --- | --- | --- | --- |
| Claude Code | 40+ 内置工具 + MCP | MCP 扩展 | 分级授权 |
| OpenClaw | Skill library | 社区 skill | SOUL.md 边界 |
| Coze | 60+ 插件 + custom API | 插件市场 | Bot 配置 |
| Cursor | Built-in tools + extensions | Extension + MCP | 用户确认 |

### 6.3 上下文/记忆对比

| 产品 | 短期上下文 | 长期记忆 | 代码库上下文 |
| --- | --- | --- | --- |
| Claude Code | Flat message history | memory.md + Chyros | Grep + AST search |
| OpenClaw | Session memory | Persistent memory store | File system access |
| Coze | Dialog context | User profile + memory | Knowledge base RAG |
| Cursor | Conversation + editor state | 有限 | Codebase semantic index |

### 6.4 流式/UI 对比

| 产品 | 流式协议 | UI 形态 | 取消/重连 |
| --- | --- | --- | --- |
| Claude Code | SSE / HTTP streaming | CLI TUI | Ctrl+C 取消 |
| OpenClaw | 依赖通道协议 | Chat UI / CLI | 通道原生 |
| Coze | SSE | Web chat / social | 重连由平台处理 |
| Cursor | SSE | IDE inline / chat | 用户可中断 |

---

## 七、生产设计模式提炼

### 7.1 模式 1：主循环 + 工具注册表

几乎所有 Agent 都有类似结构：

```text
while not done:
  response = model.generate(messages, tools)
  if response.tool_call:
    result = execute_tool(response.tool_call)
    messages.append(tool_result)
  else:
    return response.content
```

差异在于：
- Claude Code 强调单线程和可调试性。
- Coze 强调可视化 workflow。
- Cursor 强调与 IDE 的紧密集成。

### 7.2 模式 2：分层记忆

生产 Agent 普遍需要：
- 短期上下文（当前 session）。
- 中期状态（任务 checkpoint）。
- 长期记忆（用户画像、项目约定）。
- 外部知识（RAG / 代码库索引）。

### 7.3 模式 3：工具权限分级

- Read-only 工具默认允许。
- Write 工具需要确认。
- 高风险工具（支付、删除、执行代码）需要 explicit confirmation。
- 支持 auto-approve 模式用于可信环境。

### 7.4 模式 4：Diff-based 编辑

对于代码修改：
- 先生成 diff。
- 用户审查后 apply。
- 支持 undo 和 git 回滚。

Claude Code 和 Cursor 都采用这种模式，降低风险。

### 7.5 模式 5：配置驱动的人格与边界

OpenClaw 的 SOUL.md 和 Coze 的 Bot 配置都体现了：
- Agent 行为应该可配置、可版本化。
- 操作边界要明确，防止越权。

---

## 八、失败路径与生产教训

### 8.1 幻觉导致的错误工具调用

- 模型可能调用不存在的工具或传错参数。
- **应对**：schema 校验、工具名白名单、参数类型检查、错误后让模型修正。

### 8.2 长 session 上下文爆炸

- 多轮对话后 token 消耗剧增，模型注意力分散。
- **应对**：summarization、sliding window、RAG 检索、三层记忆。

### 8.3 工具有副作用但执行失败

- 如 bash 命令执行一半失败，文件处于中间状态。
- **应对**：事务性操作、diff-based 编辑、checkpoint、状态查询。

### 8.4 多 Agent 状态冲突

- Fleet 或多 Agent pipeline 中可能互相覆盖状态。
- **应对**：明确职责边界、共享状态加锁、最终一致性设计。

### 8.5 用户隐私与数据安全

- Agent 可能读取敏感文件、访问敏感 API。
- **应对**：权限分级、sandbox、audit log、数据隔离、确认 gate。

---

## 九、面试题与应答脚本

### Q1：Claude Code 为什么要用单线程主循环？

**答**：为了可调试性和确定性。编程任务需要精确控制执行顺序，单线程避免了多 Agent 协作中的状态冲突和竞态。Claude Code 通过工具级并行和 streaming 来弥补性能，而不是在主循环中引入复杂并发。

**追问**：
- 什么情况下应该打破单线程？（需要同时监控多个外部事件、或执行大量独立子任务时。）
- Claude Code 有没有并发？（有，工具执行可以并行，主循环做协调。）

### Q2：OpenClaw 的 SOUL.md 解决了什么问题？

**答**：把 Agent 的人格、边界、技能以声明式配置管理，让非开发者也能定制 Agent。它解决了「同一个 Agent 框架如何适配不同角色和场景」的问题。

**追问**：
- SOUL.md 和 system prompt 有什么区别？（SOUL.md 更结构化，包含技能、边界、多通道行为；system prompt 更偏向对话风格。）
- 配置驱动会不会限制 Agent 灵活性？（会；适合边界明确的场景，不适合强探索性任务。）

### Q3：Coze 的插件市场和 Claude Code 的工具有什么本质区别？

**答**：
- Coze 插件是平台化、可视化的能力扩展，面向低代码用户，通过 OpenAPI 接入。
- Claude Code 工具是内置的、面向编程场景的精细化工具，通过 MCP 扩展。
- Coze 强调生态和易用；Claude Code 强调精确和可控。

**追问**：
- 如果你要做一个企业内部 Agent 平台，更像谁？（取决于用户是业务人员还是开发者；可以混合：底层像 Claude Code 的工具系统，上层像 Coze 的可视化配置。）

### Q4：Cursor 的 Context Engine 为什么重要？

**答**：代码库通常很大，远超模型上下文窗口。Context Engine 通过语义索引把用户当前问题与相关代码关联起来，让模型只看到最有用的上下文，从而生成更准确、更一致的代码。

**追问**：
- Context Engine 和 RAG 有什么区别？（类似；但 Context Engine 更针对代码结构，包含符号、调用关系、类型信息。）
- 如何更新索引？（文件保存时增量更新，或定时全量重建。）

### Q5：这四款产品如何处理安全？

**答**：
- Claude Code：工具权限分级、AST 检查、自动模式开关。
- OpenClaw：SOUL.md 边界、本地优先减少数据泄露。
- Coze：平台级权限、租户隔离、插件审核。
- Cursor：用户确认 diff、extension 沙箱、权限提示。

**追问**：
- 哪款产品安全风险最高？（取决于使用场景；能执行任意代码的工具如 bash/python 风险最高，需要 sandbox。）
- 如何防止 Prompt Injection 诱导 Agent 调用高风险工具？（输入过滤、输出侧 policy check、confirmation gate。）

### Q6：如果从零设计一个 Claude Code 竞品，你会借鉴哪些点？

**答**：
- 单线程主循环 + 有限并发的 Agent Runtime。
- Diff-based 代码编辑和 git 集成。
- 分层记忆（项目约定 + 实时搜索 + 后台索引）。
- 工具权限分级 + MCP 扩展。
- 本地优先的可选部署。

**追问**：
- 你会做什么不同？（更早支持多 Agent Fleet；更强的本地模型支持；更完善的 eval 和 observability。）

### Q7：Coze 如何做到低代码？牺牲了什么？

**答**：
- 通过可视化配置、模板、插件市场降低门槛。
- 牺牲了灵活性和可控性：复杂逻辑难以表达，调试困难， vendor lock-in。

**追问**：
- Coze 适合什么企业？（需要快速上线客服、营销机器人的企业。）
- 不适合什么？（需要深度定制、数据主权、复杂工作流的企业。）

### Q8：Cursor 的多 Agent Fleet 会面临什么工程挑战？

**答**：
- 状态同步：多个 Agent 操作同一代码库。
- 冲突解决：两个 Agent 修改同一文件。
- 上下文管理：每个 Agent 的上下文独立又需要共享。
- 用户认知：用户如何理解多个 Agent 的行为。

**追问**：
- 怎么解决冲突？（git 冲突检测、锁机制、明确的职责分工。）
- Fleet 中的 Agent 需要不同模型吗？（可以；简单任务用小模型，复杂任务用大模型。）

### Q9：这些产品的商业模式有什么共同点？

**答**：
- 都通过模型调用收费（按 token / 按请求）。
- 都提供免费 tier 吸引用户。
- 都通过生态（插件、skill、marketplace）增加粘性。
- 都强调 productivity gain 来支撑订阅价格。

**追问**：
- 开源产品 OpenClaw 怎么盈利？（可能通过托管服务、企业支持、云服务。）

### Q10：未来 AI Agent 产品会向什么方向演进？

**答**：
- 从单 Agent 到多 Agent 协作。
- 从云端到本地/混合部署。
- 从通用到垂直领域深度优化。
- 从工具调用到主动规划和长期任务执行。
- 从黑盒到可解释、可审计。

---

## 十、开放设计题

1. **设计一个 Claude Code 的本地开源替代品**：需要支持代码理解、编辑、bash 执行、git 操作。说明架构选择、工具系统、安全措施、与 Claude Code 的差异。

2. **设计一个企业级 Coze-like 平台**：支持多租户、自定义插件、知识库、工作流、多渠道发布。说明如何实现数据隔离、插件安全、工作流引擎。

3. **设计一个 Cursor Fleet 的冲突解决系统**：多个 Agent 同时修改同一项目。说明锁策略、diff 合并、用户审查流程。

---

## 十一、参考资料

- [Claude Code Leak: A Deep Dive into Anthropic's AI Coding Agent Architecture](https://redreamality.com/blog/claude-code-source-leak-architecture-analysis/)
- [Claude Code Agent Architecture - ZenML LLMOps Database](https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding)
- [What Is the Anthropic Claude Code Source Code Leak? Three-Layer Memory Architecture Explained](https://www.mindstudio.ai/blog/claude-code-source-leak-three-layer-memory-architecture)
- [OpenClaw (Formerly Clawdbot & Moltbot) Explained](https://milvus.io/blog/openclaw-formerly-clawdbot-moltbot-explained-a-complete-guide-to-the-autonomous-ai-agent.md)
- [OpenClaw Review: The Open-Source Local AI Agent](https://vibecoding.app/blog/openclaw-review)
- [Coze Review: ByteDance's AI Agent Builder](https://aitoolsrecap.com/Reviews/coze-review)
- [ByteDance Open-Sources AI Agent Platform 'Coze'](https://en.tmtpost.com/news/7641222)
- [Cursor 3 Unified Agent Workspace Architecture 2026](https://github.com/FreezeSoul/agent-engineering-by-openclaw/blob/master/articles/practices/ai-coding/cursor-3-unified-agent-workspace-architecture-2026.md)
- [Beyond Cursor: From AI Editor to Agent Workspace](https://nimbalyst.com/blog/beyond-cursor-why-the-future-starts-with-the-agent)
