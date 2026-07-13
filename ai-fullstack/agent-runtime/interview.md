# Agent Runtime 面试深度问答

## 核心概念地图

1. **Agent vs Chatbot**：Chatbot 只做对话，Agent 能感知环境、做决策、调用工具、完成任务。
2. **Plan**：把复杂目标拆成可执行步骤；Plan 可以是一次生成，也可以是迭代修正。
3. **Session / State**：一次任务的生命周期，包含上下文、中间结果、checkpoint。
4. **Tool Calling**：Agent 与外部世界交互的唯一手段；需要 schema、权限、幂等。
5. **Event Stream**：Agent 内部所有状态变化通过事件流对外暴露，便于 UI、Tracing、Eval 消费。

## 架构与数据流

```text
User Intent
  → Session Manager（创建/恢复 session）
  → Planner（生成 plan）
  → Executor Loop（逐个执行 step）
    → Tool Registry（查找工具）
    → Tool Executor（执行并返回结果）
    → Human Gate（高风险确认）
  → Final Response
  → Event Stream（plan / tool / message / error）
```

关键状态机：

```text
idle → planning → executing → awaiting_confirmation → observing → done/error
```

## 关键设计决策

### 1. Planner 应该一次性生成完整计划还是逐步规划？

- **Plan-and-Execute**：先出完整 plan，再执行。适合任务边界清晰、步骤可枚举的场景。
- **ReAct**：每执行一步后让模型决定下一步。适合探索性强、需要中间观察的任务。
- **Reflexion / Tree-of-Thoughts**：执行失败后反思并重新规划。适合复杂推理。

**Trade-off**：一次性 plan 可解释性强、延迟低；ReAct 更灵活但 token 消耗高、延迟高。

### 2. Agent 如何恢复中断任务？

- 每次 step 完成后保存 checkpoint（session state + 已完成 step + 中间结果）。
- 恢复时从 checkpoint 加载，继续执行未完成的 step。
- checkpoint 需要持久化到数据库，不能仅存内存。

### 3. 多 Agent 如何协作？

- **Supervisor**：一个主 Agent 分配任务给多个子 Agent。
- **Router**：根据用户意图把请求路由到不同 Agent。
- **Peer-to-Peer**：Agent 之间通过共享 memory 或 message bus 协作。

## 失败路径与恢复

| 失败 | 原因 | 恢复 |
| --- | --- | --- |
| Plan 不可执行 | 模型生成不存在/不合法的 step | plan validator 拦截，要求模型重出 plan |
| 工具参数错误 | schema 不匹配、类型错误 | validator 修复或返回错误让模型重试 |
| 工具超时 | 下游服务慢 | 系统重试 + fallback；Agent 层面可换工具 |
| 工具有副作用但结果未知 | 网络超时发生在 commit 后 | 幂等 key + 状态查询接口 |
| 用户取消 | 前端发送 cancel | AbortController 中断，保存 checkpoint |
| 模型输出冲突 | 模型忘记已执行结果 | 严格上下文管理 + summarization |
| 循环调用 | 工具结果又触发同类工具 | 最大 step 限制 + loop detection |
| 权限不足 | 工具需要用户确认 | Human Gate 暂停，等待用户授权 |

## 面试题与应答脚本

### Q1：Agent 和 Chatbot 的本质区别是什么？

**答**：Chatbot 只做语言生成，输入是历史对话，输出是回复。Agent 有目标、有环境感知、能调用工具、能根据反馈调整行为。Agent 的核心是「感知-决策-执行-观察」的循环。

**追问**：
- 如果一个 Chatbot 只是回答知识问题，算不算 Agent？（不算，因为它没有工具调用和状态。）
- 一个 RAG 问答系统算不算 Agent？（狭义上不算；如果它能根据检索结果决定是否调用计算器/数据库，就是 Agent。）

### Q2：ReAct、Plan-and-Execute、Reflexion 各适合什么场景？

**答**：
- ReAct：适合探索性任务，比如「帮我查一下北京明天天气，再决定穿什么」。
- Plan-and-Execute：适合流程明确的任务，比如「提交报销单」。
- Reflexion：适合需要多轮试错的问题，比如数学证明、复杂调试。

**追问**：
- 能不能把它们结合起来？（可以：先用 Plan-and-Execute 出大纲，执行中某步失败时用 Reflexion 局部重试。）
- Plan 失败了怎么办？（fallback 到 ReAct 逐步执行，或降级为直接回答。）

### Q3：Agent 的 Session 里应该存什么？

**答**：
- 用户输入和历史消息。
- 当前 plan 和已执行 step。
- 每个 tool call 的参数、结果、状态。
- checkpoint（可恢复点）。
- metadata：创建时间、模型版本、token 消耗。

**追问**：
- Session 数据存在哪里？（短期存内存/Redis，长期持久化到数据库/S3。）
- 如何控制 Session 大小？（滑动窗口、summary、rag-based memory retrieval。）

### Q4：如何避免 Agent 重复执行支付、发送消息等副作用工具？

**答**：
- 每个 tool call 分配唯一 idempotency key。
- 工具执行前检查 key 是否已执行过。
- 对高副作用工具加 human confirmation gate。
- 工具层实现幂等执行（下游服务也支持幂等）。

**追问**：
- 如果工具执行成功但网络返回超时，Agent 会怎么做？（先查询状态接口；若成功则直接使用结果；若失败才重试。）
- idempotency key 存在哪里？（持久化存储，至少与 session 同生命周期。）

### Q5：Human-in-the-loop 怎么设计？

**答**：
- 给工具打 risk tag（high / medium / low）。
- high risk 工具执行前暂停，发送 `requires_confirmation` 事件。
- UI 展示工具名、参数、影响范围，等待用户确认/拒绝。
- 超时未确认则默认拒绝，并通知 Agent。

**追问**：
- 用户拒绝后 Agent 如何继续？（Agent 收到拒绝结果，可尝试替代工具或直接告知用户无法完成。）
- 哪些场景必须 human gate？（支付、删除数据、发送消息给外部、访问敏感信息。）

### Q6：Agent 调用工具失败了，谁来决定重试？

**答**：分三层：
1. **工具执行层**：网络抖动等 retryable 错误自动重试（带指数退避）。
2. **Agent 执行层**：参数错误等让模型根据错误信息修正后重试。
3. **用户层**：权限不足、需要补充信息时暂停并询问用户。

**追问**：
- 如果重试三次都失败怎么办？（标记 step 失败，进入 fallback 或结束 session。）
- 模型会不会陷入无限重试？（需要 max retry limit 和 loop detection。）

### Q7：如何评估一个 Agent 的好坏？

**答**：
- **Task completion**：是否完成用户目标。
- **Step efficiency**：用了多少步，是否绕路。
- **Tool accuracy**：是否选对工具、参数是否正确。
- **Recovery**：失败时能否恢复。
- **Latency / Cost**：响应时间和 token 消耗。
- **User satisfaction**：用户是否接受结果。

**追问**：
- 这些指标怎么收集？（通过 event stream 记录每个 step 和 tool call；用 golden set 跑回归。）
- 哪个指标最难提升？（通常 recovery 和 step efficiency 最难，需要更好的 planner 和 tool schema。）

### Q8：Agent 的上下文窗口不够用了怎么办？

**答**：
- 对历史消息做 summarization。
- 只保留关键 tool result，丢弃中间过程。
- 用 memory / RAG 检索相关历史，而不是全塞上下文。
- 对长文档先 chunk 再检索。

**追问**：
- summarization 会不会丢失关键信息？（会；关键决策点、用户确认结果必须保留原始记录。）
- 如何验证 summarization 没丢信息？（Eval 中专门测长上下文任务。）

### Q9：多 Agent 系统如何路由用户请求？

**答**：
- 先由一个 Router Agent 判断意图和领域。
- 根据领域分发到专用 Agent（客服 Agent、代码 Agent、数据分析 Agent）。
- 专用 Agent 处理完后返回结果，必要时由 Router 汇总。

**追问**：
- 如果两个 Agent 都能处理怎么办？（可以定义优先级，或让 Router 选择最匹配的。）
- Agent 之间如何共享状态？（通过共享 session、message bus 或 memory store。）

### Q10：Agent 输出不安全内容怎么办？

**答**：
- 在 Planner 和 Executor 之间加 safety policy check。
- 对工具调用做权限校验（用户是否有权访问该资源、执行该动作）。
- 高风险操作走 human confirmation。
- 所有决策记录 audit log。

**追问**：
- policy check 应该在哪一层做？（在 tool call 请求生成后、执行前；也在 plan 生成后做预判。）
- 误拦截怎么解决？（允许用户申诉，收集反馈优化 policy。）

## 开放设计题

1. **设计一个能处理退款请求的客服 Agent**：用户说「我要退款」，Agent 需要查订单、判断退款规则、调用退款工具、通知用户。画出状态机和事件流，说明如何处理「退款已提交但状态未知」的情况。

2. **设计一个多 Agent 协作的代码助手**：包括需求理解 Agent、代码生成 Agent、测试 Agent、审查 Agent。说明它们如何通信、如何合并结果、如何处理冲突。

3. **设计 Agent 的 checkpoint 与恢复机制**：考虑数据库、网络、模型失败，说明 checkpoint 保存时机、数据格式、恢复流程。

## 与其他模块的关系

- **Tool Calling**：Agent 通过 Tool Calling 与外部交互；Tool Calling 的 schema、幂等、错误分类直接影响 Agent 稳定性。
- **Memory**：Agent 的上下文管理依赖 Memory；长期记忆让 Agent 更个性化。
- **RAG**：Agent 面对知识型问题时可调用 RAG 检索。
- **Eval**：Eval 定义 Agent 的 completion、efficiency、recovery 指标。
- **Observability**：Agent 的 plan、tool call、latency 全部需要 trace。
- **Safety**：Agent 的高风险动作需要 Safety 的 policy 和 confirmation gate。
- **Workflow Orchestration**：对于确定性流程，可用 Workflow 替代 Agent 的部分规划逻辑。
