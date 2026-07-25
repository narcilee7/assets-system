# Claude Code 深度解析与面试题集

> 面向校招后端 / AI Agent 方向的系统性研究笔记，版本 2026.07

---

## 阅读说明

- **【确认事实】**：来自 Anthropic 官方文档、Claude Code 命令手册、官方定价页、GitHub issue/PR 原文，或创始人 Boris Cherny 公开访谈。
- **【合理推断】**：基于官方文档、逆向工程报告、社区实测与工程常识推导；已标注推理依据。
- 金额单位为 USD。

---

# 第一部分：Claude Code 深度解析

## 第 1 章 产品定位与边界

### 1.1 核心结论

- **Claude Code 是什么**：Anthropic 出品的终端原生（terminal-first）Agentic Coding 工具，以 CLI 为主入口，可在终端内完成代码阅读、多文件编辑、命令执行、测试运行、Git 操作、PR 创建等完整开发闭环。【确认事实：官方 Overview】
- **Claude Code 不是什么**：它不是 IDE 插件（虽有 VS Code/JetBrains 扩展）、不是纯自动补全工具、不是完全自主无需监督的 Agent（Devin 路线）。【确认事实：官方文档称 Terminal 是 primary surface】
- **产品哲学**：终端优先、Unix utility 化，可组合、可脚本化、可嵌入 CI/CD 与 shell pipeline。【合理推断：创始人 Boris Cherny 多次公开表达此观点】
- **商业模式**：免费安装，后端模型调用计费。API 模式企业平均约 $13/活跃开发者/天、$150–250/开发者/月，90% 用户日消耗低于 $30。【确认事实：官方 Costs 文档】

### 1.2 与竞品的差异矩阵

| 维度 | Claude Code | Copilot | Cursor | Windsurf | Devin |
|---|---|---|---|---|---|
| 主形态 | CLI + 多 surface | IDE 插件 | VS Code 分支 | 独立 Flow IDE | 云端沙箱 Agent |
| Agent 深度 | 高（ReAct） | 中低 | 高（Composer+MCP） | 高 | 最高 |
| 上下文窗口 | 200K / 1M | 128K–200K | 200K 标称，常被截断 | 200K | 云端弹性 |
| 代码库理解 | 无预索引，运行时搜索 | 云端+本地语义索引 | Turbopuffer 向量索引 | AST 级本地索引 | 云端完整环境 |
| 终端/CI 适配 | 原生强项 | 弱 | 中等 | 中等 | 云端 |
| 月费级距 | $20 Pro / $100+ Max | $10–39 | $20 | $15 | $20 + ACU |
| 最适场景 | DevOps、批量重构、脚本自动化 | 日常补全 | 全栈开发 | 快速原型 | 端到端复杂任务 |

【合理推断：综合官方定价与多篇对比评测】

### 1.3 为何 Anthropic 选择"终端优先"？

1. **可组合性**：`tail -200 app.log | claude -p "..."` 是 IDE 插件做不到的 Unix pipeline。【确认事实：官方文档示例】
2. **零 IDE 锁定**：不依赖特定编辑器，覆盖更广开发者。
3. **Agent 循环天然适配终端**：输入 → 工具调用 → 观察结果 → 再调用。
4. **CI/CD 友好**：`-p` 非交互模式可直接嵌入 GitHub Actions。【确认事实：官方 Headless 文档】

### 1.4 用户画像

- **个人开发者**：终端内完成 feature/fix/refactor/commit/PR。
- **团队协作**：通过 `.claude/`、`CLAUDE.md`、Slash Commands 共享规范。
- **企业级场景**：集中成本管理、spend limit、MCP 接入内部系统、CI 自动化 review。

---

## 第 2 章 系统架构（核心）

### 2.1 整体架构

**核心结论**：Claude Code CLI 是本地 Client，模型调用通过 Anthropic Messages API 直连云端（或 Bedrock/Vertex 托管端点）。【确认事实：官方 Overview 与 vLLM 集成文档】本地 Runtime 负责工具循环、上下文管理、MCP 客户端与文件系统操作；模型推理上云。【合理推断：CLI 为 Node.js runtime】

### 2.2 上下文管理系统

#### 2.2.1 关键事实：Claude Code 不预索引代码库

- 官方确认：**没有** Codebase Index、**没有**向量数据库、**没有**预计算 embedding。依靠运行时工具链 `Glob → Grep → Read` 按需探索。【确认事实：Boris Cherny 在 HN 与 Latent Space 播客】
- 这种设计称为 **Agentic Search**：模型自己决定搜什么、怎么搜，而非一次性接收预检索 Top-K。

#### 2.2.2 工具层级与 Token 经济学

| 工具 | 作用 | Token 成本 | 典型使用 |
|---|---|---|---|
| Glob | 文件路径模式匹配 | 接近 0 | `workers/**/*.toml` |
| Grep | 正则内容搜索（底层 ripgrep） | 低 | 找符号、调用链 |
| Read | 读取完整文件内容 | 高（500–5000/文件） | 确认并加载目标文件 |
| Explore agent | 只读子 Agent（Haiku） | 隔离，不污染主窗口 | 深度探索后返回摘要 |

【确认事实：官方工具列表；成本来自社区逆向工程】

#### 2.2.3 为什么不用 RAG？

创始人 Boris Cherny 的理由：

1. **精确性**：代码符号 `getUserById` 必须字面命中，向量相似会召回 `verifyToken` 等干扰。
2. **简洁性**：无索引构建、维护、同步开销；打开即用。
3. **新鲜性**：grep/Read 读磁盘最新状态，无索引滞后。
4. **隐私/安全**：不向外发送代码做 embedding。

【确认事实：Boris Cherny 公开访谈】

#### 2.2.4 上下文窗口分配策略（合理推断）

标准窗口 200K tokens（部分模型/计划达 1M）。一次请求粗分：

| 来源 | 估算占比 | 说明 |
|---|---|---|
| 系统提示 + 工具 Schema | 5%–15% | 工具定义、安全规则 |
| CLAUDE.md / .claude/ 配置 | 5%–20% | 项目级指令 |
| 对话历史 | 30%–60% | 触发 compaction 后变摘要 |
| 工具结果 | 20%–50% | 会被截断/摘要 |
| 当前用户输入 | <5% | 通常较小 |

- **Prompt caching**：92% prefix 可复用，cache read 成本为 base 的 0.1x，整体成本降约 81%。【合理推断：LMCache 2025.12 报告】
- **定价悬崖**：超过 200K tokens 后输入单价从 $3/M 翻倍至 $6/M。【确认事实：Anthropic API 定价页】

### 2.3 工具调用体系

#### 2.3.1 内置工具

约 18 个，核心包括：Read/Write/Edit（文件）、Glob/Grep（搜索）、Bash（命令）、Task（子 Agent）、WebFetch/WebSearch（网络）、LS/View 等。【确认事实：官方文档与社区逆向工程】

#### 2.3.2 工具 Schema

- 以 **JSON Schema** 描述，符合 Anthropic Messages API Tool Use 规范。模型返回 `tool_use` 块，含 `name` 与 `input`（对象）。【确认事实：Anthropic Tool Use 文档】
- 工具描述进入系统提示，直接塑造模型行为。

#### 2.3.3 串行 vs 并行

- **现状**：工具调用以串行为主，一轮可返回多个 `tool_use` 块，本地 runtime 执行后回传。
- **子 Agent 并行**：`Task` 生成独立子 Agent，可并行处理不同子任务。
- **趋势**：Relace FAS 实验证明 RL 训练子 Agent 可并行调用 4–12 个工具，延迟降约 4 倍。【合理推断：Relace 论文与社区 PR】

#### 2.3.4 工具结果回传

以 `tool_result` 块返回，含成功/失败状态、stdout/stderr、退出码。长输出截断/摘要；失败结果结构化回传，模型据此重试或求助。

### 2.4 状态机设计

#### 2.4.1 一次对话生命周期

```
User Input → Context Assembly → LLM Inference → Tool Planning
                                                  │
                                                  ▼
Final Answer ← Response Generation ← Result Observation ← Tool Execution
```

典型 **ReAct 循环**。【合理推断：逆向工程与社区分析一致】

#### 2.4.2 记忆管理

- **短期记忆**：当前会话完整对话与文件状态；接近窗口上限时自动 compaction 生成摘要。
- **长期记忆**：`CLAUDE.md`（静态）、Auto-memory（动态学习，跨会话复用）。

#### 2.4.3 分支与回退

- **`/branch`**：创建对话分支。
- **`/rewind`**：每个用户提示前自动创建 checkpoint，可回滚代码/对话/两者，默认保留 30 天。
- **限制**：checkpoint 只追踪 Claude Code 文件编辑工具的修改，不追踪 Bash 命令（`rm/mv/cp`）的外部变更。【确认事实：官方 Checkpointing 文档】

---

## 第 3 章 工程实现细节（核心）

### 3.1 本地文件系统安全模型

- **默认权限**：对当前工作目录读写；首次进入未信任目录提示确认；`/add-dir` 可扩大范围。
- **破坏性操作确认**：写入、Bash、MCP 等敏感操作默认弹权限提示。系统提示禁止 `rm -rf`、`git checkout HEAD -- .` 等。
- **现实风险**：GitHub 上存在绕过确认导致数据丢失的 issue（如 `rm -rf`、`doctrine:fixtures:load`）。【确认事实：GitHub issue #30700、#37574、#11821】
- **Undo/Redo**：`/rewind` 提供会话级恢复；但非原子事务，最佳实践是先用 Git 提交。

### 3.2 Bash 工具沙箱

- **执行方式**：本地子进程，继承 Claude Code 环境变量；Windows 无 Git for Windows 时回退 PowerShell。
- **Secrets**：依赖用户环境变量；避免在 prompt 中直接粘贴密钥。
- **长命令**：有默认 timeout；支持 `/background` 后台运行。
- **交互式命令**：支持有限，建议避免 `vim/less/confirm`，改用非交互参数。【确认事实：GitHub issue #27294】

### 3.3 网络与 Git 集成

- **外部 API**：WebFetch/WebSearch 原生工具；复杂集成通过 MCP。
- **Git 集成**：本地调用 `git`/`gh`，可 diff/branch/commit/push/创建 PR；`/autofix-pr` 启动云端 Agent 监控 PR 并自动修复。

### 3.4 并发与异步

- **多文件编辑**：同一 loop 通常顺序编辑；大规模重构用 `/batch` 分解为 5–30 个独立单元，在独立 git worktree 中由后台子 Agent 并行处理。
- **工具并行**：同一轮多个 `tool_use` 块可并行执行无依赖的 Read/Grep/Bash。
- **流式渲染**：SSE 流式 Anthropic Messages API；CLI 用自定义 React reconciler + Yoga layout 渲染 Markdown/代码高亮/Diff/Spinner/成本。

### 3.5 错误处理与恢复

- 工具失败时把 stdout/stderr/exit code 结构化回传，模型决定重试、换工具或求助。
- JSON Schema 做参数校验；非法参数直接拒绝，模型下一轮修正。
- 最大回合数限制（基准测试常见 150 turns）；子 Agent 超时策略仍有完善空间。【确认事实：arXiv 论文与 GitHub issue #44783】

### 3.6 终端 UI

- 分阶段展示：thinking（verbose 模式）→ tool call 摘要 → diff → 最终结果。
- `/usage` 显示成本、token 用量、各工具/MCP/子 Agent 占比。

---

## 第 4 章 扩展与生态

### 4.1 MCP

- Claude Code 是 **MCP Client**，连接外部工具服务器；也可作为 **MCP Server**，把自身工具暴露给 Desktop/Cursor/Zed。
- 与原生工具**互补**：原生低 overhead；MCP 覆盖 SaaS/内部系统，支持 deferred loading 减少上下文消耗。
- 传输层：stdio（本地）、SSE（deprecated）、Remote HTTP（streamable-http，推荐）。配置在 `~/.claude/mcp.json` 或项目级 `.claude/mcp.json`。

### 4.2 自定义能力

- **Slash Commands**：`.claude/commands/` 项目级、`~/.claude/commands/` 个人级；markdown 文件即 prompt。
- **`CLAUDE.md`**：项目根目录，包含风格、架构、构建/测试命令。官方建议保持 200 行以内。
- **Hooks**：PreToolUse/PostToolUse 可在工具调用前后执行脚本，过滤/预处理输出。

### 4.3 与开发工作流衔接

- **CI/CD**：`claude -p "prompt"` 非交互模式，配合 `--output-format stream-json` 可解析，支持 pipe 输入。
- **Code Review**：`/code-review` 多 Agent 并行审查；`/review [PR]` 快速只读 review；GitHub App 自动 review。
- **团队并发**：无全局锁；多开发者同时使用等价于多人同时改代码，依赖 Git 合并解决。

---

## 第 5 章 性能与优化

### 5.1 冷启动

- **无索引冷启动**：打开即用，无需等待向量索引构建，相对 Cursor/Windsurf 的核心 UX 优势。

### 5.2 Token 消耗优化

| 策略 | 机制 | 效果 |
|---|---|---|
| Prompt Caching | 系统提示、工具定义、CLAUDE.md 复用 | 92% prefix 复用，成本降 ~81% |
| 自动 Compaction | 接近窗口上限时摘要历史 | 避免定价悬崖 |
| 子 Agent 隔离 | Explore/Task 把 verbose 输出留在独立窗口 | 主窗口只收摘要 |
| MCP Deferred Loading | 工具名先入上下文，schema 延迟加载 | 降低大 MCP 库 overhead |
| Hooks 预处理 | 只传高信号结果 | 如过滤测试输出 |
| Glob→Grep→Read | 按需加载 | 避免一次性读全库 |

### 5.3 延迟优化

- 瓶颈：模型推理 + 串行工具调用累积。
- 方向：并行工具调用、子 Agent 并行、prompt caching、本地 ripgrep 快速搜索。

### 5.4 成本估算

一次典型 30 分钟编码会话（API 模式）：

| 项目 | 估算 |
|---|---|
| 输入 tokens | 100K–500K |
| 输出 tokens | 10K–50K |
| 工具结果 tokens | 占输入 30%–60% |
| 单次会话成本 | $0.5–$5（Sonnet）/ $2–$15（Opus） |
| 重度开发者月成本 | $150–250（API）/ 订阅更划算 |

Claude Max $200/月 对高频用户约为按量付费的 ~18 倍优惠。【合理推断：基于官方 Costs 文档与社区测算】

---

# 第二部分：校招面试题集

## L1 基础理解

### L1-1 Claude Code 与 GitHub Copilot 最本质的区别？
- Claude Code 是终端原生 Agentic Coding 工具，通过多工具循环完成完整任务；Copilot 是 IDE 补全/Inline 助手。
- Claude Code 无预索引，靠 Glob/Grep/Read 运行时探索；Copilot 依赖语义索引。
- Claude Code 可执行 Bash、编辑文件、创建 PR；Copilot 以生成和聊天为主。

### L1-2 为什么 Claude Code 选择终端优先？
- Unix 可组合性：可嵌入 pipeline 与 CI/CD。
- 零 IDE 锁定，覆盖更广开发者。
- 终端是 Agent 循环（输入→工具→观察）的天然载体。

### L1-3 Claude Code 不用 RAG 的核心原因？
- 创始人明确早期试过 RAG，但 agentic search 更精确、更简单、更新鲜、更隐私。
- 代码符号需字面命中，向量相似会引入噪声；打开即用，无索引滞后。

## L2 架构设计

### L2-1 描述一次用户请求的完整生命周期。
- 用户输入 → Context Assembly（CLAUDE.md、历史、记忆）。
- LLM Inference → 生成 thinking + tool_use。
- Tool Planning/Execution（Read/Edit/Bash/Task）。
- Result Observation 回传模型；循环直到无 tool_use，输出最终回复。

### L2-2 上下文窗口如何分配？
- 标准 200K tokens，部分模型/计划达 1M。
- 系统提示+Schema 5%–15%；CLAUDE.md 5%–20%；历史 30%–60%；工具结果 20%–50%；用户输入 <5%。
- 通过 prompt caching 与 compaction 控制成本与长度。

### L2-3 为何把工具拆成 Read/Edit/Bash/Grep/Glob，而非一个万能 Bash？
- 权限边界清晰：只读/只写/执行可分别控制。
- 返回结构可控：路径、行号、退出码、diff 标准化。
- 工具描述进入系统提示，塑造模型行为；便于审计、缓存与成本归因。

### L2-4 子 Agent（Task 工具）解决什么问题？
- 隔离深度探索的 token 消耗，避免污染主上下文。
- 实现并行处理不同子任务；Explore agent 只读大量文件后返回摘要。

### L2-5 MCP 在 Claude Code 中的角色？
- Claude Code 是 MCP Client，连接外部工具服务器；也可作为 MCP Server 暴露工具给 Desktop/Cursor/Zed。
- MCP 与原生工具互补：原生低 overhead，MCP 覆盖 SaaS/内部系统。

## L3 工程实现

### L3-1 Bash 工具是沙箱吗？安全如何保障？
- Bash 通过本地子进程执行，不是容器隔离；继承 Claude Code 环境变量。
- 敏感操作默认需用户确认，支持 allow/ask/deny/Auto mode。
- 系统提示禁止破坏性命令，但历史上仍有绕过案例；Git 与 checkpoint 是最后兜底。

### L3-2 文件修改如何 Undo？checkpoint 为何不能替代 Git？
- `/rewind` 回滚到之前 checkpoint，恢复代码/对话/或两者。
- Checkpoint 只追踪 Claude Code 文件编辑工具的修改，不追踪 Bash 产生的 `rm/mv/cp`。
- 多会话/多用户外部修改无法被 checkpoint 捕获。

### L3-3 模型幻觉产生无效工具调用时如何容错？
- JSON Schema 做参数校验；非法参数直接拒绝。
- 工具执行失败结构化回传（stdout/stderr/exit code）；模型下一轮修正，必要时求助用户。

### L3-4 如何减少 token 消耗？
- Prompt caching（92% prefix 复用，成本降 ~81%）。
- 按需检索 Glob→Grep→Read，避免读全库。
- 子 Agent 隔离 verbose 输出；Hooks 预处理；MCP deferred loading；自动 compaction。

### L3-5 流式输出如何实现？
- Anthropic Messages API SSE streaming。
- 本地自定义 TUI（React reconciler + Yoga layout）。
- 分阶段渲染：thinking → tool call 摘要 → diff → 最终结果。

## L4 开放思考

### L4-1 若设计 Claude Code 企业版，你会改什么？
- 细粒度权限与审计：目录白名单、操作日志、审批流。
- 集中成本治理：团队 spend limit、按项目/人归因、预算告警。
- 企业 MCP 市场：内部系统 connector、SSO/OAuth、secrets 托管。
- 多开发者并发：基于 Git 的锁/分支策略、共享 checkpoint。

### L4-2 AI Coding Agent 最大的工程化挑战？
- 长上下文与注意力衰减：1M token 未必能精确使用。
- 安全性：LLM 可能绕过提示与权限执行破坏操作。
- 可观测性：Agent 决策链路长，失败归因困难。
- 成本与延迟：token 消耗与多轮工具调用叠加。

### L4-3 Google/Meta 规模代码库，"无索引"方案还适用吗？
- 不适用：超大规模 monorepo 中 grep 迭代会烧掉大量 token 与时间。
- 需要混合架构：预索引粗筛（向量/AST/符号表）+ agentic search 精确定位。

### L4-4 设计面向校招的 AI Coding Agent，优先做哪些取舍？
- 先做窄场景：单语言/框架、限定工具集，保证稳定。
- 优先可读性与可审计：每次修改展示 diff，所有工具调用可回查。
- 安全优先：破坏性操作必须确认、默认只读、目录沙箱。
- 成本敏感：小模型做搜索/摘要，大模型做决策与生成。

---

# 第三部分：面试速查表

## 10 个关键数字

| 数字 | 含义 |
|---|---|
| 200K | 标准上下文窗口 tokens |
| 1M | Opus 4.6 等扩展上下文 |
| ~18 | 内置工具数量 |
| 92% | prompt prefix 复用率 |
| ~81% | prompt caching 成本降低比例 |
| $3→$6/M | 超过 200K 输入 token 的定价悬崖 |
| $13 | 企业开发者平均日成本 |
| $150–250 | 企业开发者月均成本 |
| 30 天 | checkpoint 默认保留时间 |
| 5–30 | `/batch` 分解的独立任务单元数 |

## 5 个核心架构图（面试可画）

### 图 1 整体架构
```
Terminal/IDE/Desktop/Web
         │
    Claude Code Runtime
   ┌─────┴─────┐
   │ Tool Loop │────── MCP Servers
   │ Context   │
   │ Bash/FS   │────── Anthropic API
   └───────────┘
```

### 图 2 ReAct 循环
```
Input → Context → LLM → tool_use → Execute → tool_result → LLM → Final Answer
```

### 图 3 Agentic Search 层级
```
Glob(路径) → Grep(内容) → Read(文件) → Explore Agent(深度摘要)
 低成本        中成本        高成本          隔离成本
```

### 图 4 上下文分配
```
系统提示/Schema 5%–15% | CLAUDE.md 5%–20% | 历史 30%–60% | 工具结果 20%–50% | 输入 <5%
```

### 图 5 MCP 扩展
```
Claude Code(MCP Client) ←stdio/SSE/HTTP→ MCP Servers
        │
        └── 也可作为 MCP Server 暴露工具给 Desktop/Cursor/Zed
```

## 3 个一句话定义

1. **Claude Code 的架构**：以终端为主要入口的云端 LLM Client，通过本地 ReAct 工具循环（Glob/Grep/Read/Edit/Bash/Task/MCP）完成代码理解、编辑与命令执行，模型推理放在 Anthropic API 云端。

2. **Claude Code 的核心机制**：用"无预索引的 Agentic Search"替代传统 RAG，让模型像程序员一样多轮探索代码库，并通过 prompt caching 与子 Agent 隔离控制上下文与成本。

3. **Claude Code 的产品边界**：它不是 IDE 自动补全，也不是完全自主的云端 Devin，而是一个需要用户监督、可脚本化、强调可组合性的终端 Agentic Coding 工具。

---

*本文档用于个人学习与研究，部分内容为基于公开资料的合理推断，已在文中标注。*
