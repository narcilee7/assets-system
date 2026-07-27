# LangGraph

# LangGraph 技术架构全景深度分析

## 一、设计哲学与生态定位

LangGraph 的核心哲学可以概括为 **"少抽象，多控制"**。它不预设 Agent 应该如何思考或协作，而是提供最小化的原语——Node、Edge、State——让开发者自行组合出任意复杂的执行图。

这与 LangChain 的 LCEL（链式组合器）形成根本性的架构分歧：

| 维度 | LangChain (LCEL) | LangGraph (StateGraph) |
|---|---|---|
| **核心抽象** | Runnable 接口，管道符 `|` 组合 | StateGraph，节点是函数，边是状态转移 |
| **执行模型** | 同步/异步顺序执行，无原生循环 | Pregel 超步，离散迭代 + 投票停机 |
| **状态** | 外部 Memory 对象，无 schema | TypedDict 一等公民，逐字段 checkpoint |
| **控制流** | DAG（有向无环），有限分支 | 条件边 + 循环 + 中断恢复 |
| **心智模型** | Unix pipe | 有限状态机 + MapReduce |



2026 年的关键生态变化是：**LangGraph 已成为 LangChain 生态的事实执行引擎**。LangChain 1.0 的 `create_agent` 底层已经运行在 LangGraph 运行时之上，LangGraph 从"可选扩展"变成了"基础设施层"。

---

## 二、执行引擎：Pregel BSP 模型

LangGraph 的底层执行引擎直接借鉴了 Google 的 **Pregel** 图计算框架和 **BSP（Bulk Synchronous Parallel）** 模型。

### 2.1 核心机制

Pregel 模型可以概括为三个核心概念：

1. **顶点状态机**：每个节点（PregelNode）是一个 actor，订阅特定 channel，读取数据、执行计算、写入输出
2. **BSP 执行模型**：计算被切分为离散的超步（superstep），所有活跃节点在当前超步并行执行，完成后同步屏障，再进入下一超步
3. **消息传递**：节点间不共享内存，通过 channel 传递消息。一个节点写入 channel 的值，在下一超步被订阅该 channel 的节点读取



### 2.2 超步执行流程

```
Superstep S:
  1. 所有活跃节点并行执行 compute()
  2. 节点读取来自 S-1 的消息
  3. 节点更新自身状态
  4. 节点向 S+1 发送消息
  5. 屏障同步：所有节点完成 + 消息投递后，进入 S+1
```

这种设计天然消除了大量竞态条件——**没有人能超前执行，也没有人被落下**。

### 2.3 投票停机（Vote to Halt）

节点在完成计算后可以"投票停机"（vote to halt），进入休眠状态。当收到新消息时被唤醒。这个机制使得 Agent 可以：
- 在任务完成时自然停止
- 在需要循环时通过消息自唤醒
- 支持条件性的无限循环（如 ReAct 的 think-act-observe 循环）

---

## 三、双 API 设计：StateGraph vs Functional API

LangGraph 提供两套高级 API，最终都编译为同一个 Pregel 运行时：

### 3.1 StateGraph（Graph API）

声明式图构建，显式定义节点和边：

```python
class Essay(TypedDict):
    topic: str
    content: str | None

builder = StateGraph(Essay)
builder.add_node("write_essay", write_essay)
builder.add_node("score_essay", score_essay)
builder.add_edge(START, "write_essay")
builder.add_edge("write_essay", "score_essay")
graph = builder.compile()  # 返回 Pregel 实例
```

编译后可通过 `graph.nodes` 和 `graph.channels` 查看底层的 `PregelNode` 和 channel 映射。

### 3.2 Functional API

命令式函数组合，保留可恢复、可中断、可追踪能力：

```python
from langgraph.func import entrypoint, task, interrupt

@task
def write_essay(topic: str) -> str:
    return f"Essay about {topic}"

@entrypoint(checkpointer=MemorySaver())
def workflow(topic: str):
    essay = write_essay(topic).result()
    feedback = interrupt({"essay": essay, "action": "Please approve"})
    return {"essay": essay, "approved": feedback}
```

Functional API 在 2025 年初引入，2026 年已完全成熟，适合习惯传统函数编程的开发者。

---

## 四、状态系统：Channels + Reducers

### 4.1 State Schema

状态是 LangGraph 的一等公民，通常用 `TypedDict` 或 `Pydantic Model` 定义。每个字段自动映射为一个 **Channel**。

```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # 带 reducer 的字段
    query: str                               # 默认 LastValue channel
```

### 4.2 Channel 类型

Channel 是节点间通信的媒介，每种 channel 有不同的更新语义：

| Channel | 语义 | 适用场景 |
|---|---|---|
| **LastValue** | 存储最后一个写入的值 | 标量状态字段（默认） |
| **Topic** | Pub/Sub，可配置去重和累积 | 多值聚合、事件流 |
| **Context** | 暴露上下文管理器的值 | 外部资源生命周期管理（如 HTTP client） |
| **BinaryOperatorAggregate** | 二元运算符聚合 | 累加器、计数器 |
| **EphemeralValue** | 临时值，超步后清除 | 中间计算结果 |

### 4.3 Reducer 机制

Reducer 定义了"如何将多个节点对同一字段的写入合并为最终状态"：

```python
messages: Annotated[list, add_messages]
```

`add_messages` 是内置 reducer，处理消息去重、ID 生成、`RemoveMessage` 墓碑机制。2026 年还引入了实验性的 `messagesDeltaReducer`，专为 `DeltaChannel` 设计，保证批处理不变性。

**关键陷阱**：如果同一超步中多个节点写入同一字段且无 reducer，后写入的值会**静默覆盖**前者。这是面试和 production 中的高频 bug。

---

## 五、图拓扑：Nodes、Edges 与控制流

### 5.1 节点（Nodes）

节点是 Python/TypeScript 可调用对象，签名统一为 `(state) -> partial_update`。节点内部可以：
- 调用 LLM
- 执行工具
- 返回 `Command` 进行动态路由
- 调用 `interrupt()` 暂停执行

### 5.2 边的类型

| 边类型 | API | 能力 |
|---|---|---|
| **普通边** | `add_edge(A, B)` | 固定转移，A 完成后必到 B |
| **条件边** | `add_conditional_edges(source, path_fn)` | 根据状态动态选择目标节点 |
| **循环边** | 条件边返回已访问节点 | 实现 ReAct 循环、反思模式 |
| **START/END** | 常量 | 图入口和出口标记 |

条件边的返回类型注解（如 `Literal["allow", "deny"]`）在编译时验证所有目标节点是否已注册。

### 5.3 动态控制流：Send 与 Command

**Send**：由条件边返回，实现 Map-Reduce 模式。将特定状态的副本发送到目标节点，支持并行独立执行：

```python
# 条件边返回 Send 列表，每个 Send 携带独立状态
return [Send("process_chunk", {"chunk": c}) for c in chunks]
```

**Command**：由节点直接返回，将"状态更新"和"流控制"合并在一次原子操作中：

```python
return Command(update={"status": "done"}, goto="next_node")
```

Command 还支持跨图导航（`graph=Command.PARENT`）和 HITL 恢复（`Command(resume=...)`）。

---

## 六、持久化：Checkpointing 与 Thread 模型

### 6.1 Checkpoint 核心概念

Checkpoint 是图状态在某一时刻的完整快照，包含：
- 所有 channel 的当前值
- Channel 版本号
- 每个节点的版本跟踪
- 待写入（pending writes）—— 部分节点成功时的中间状态



### 6.2 Thread 模型

- **Thread**：由唯一 `thread_id` 标识的 checkpoint 序列
- **Checkpoint ID**：单调递增的唯一标识
- **Resume**：通过 `thread_id` + `checkpoint_id` 精确定位恢复点

```python
config = {"configurable": {"thread_id": "session_001"}}
# 第一次运行
result1 = app.invoke({"query": "AI trends"}, config=config)
# 中断后从断点继续
result2 = app.invoke(None, config=config)
```



### 6.3 Checkpointer 后端

| 后端 | 包 | 异步支持 | 适用场景 |
|---|---|---|---|
| `InMemorySaver` | `langgraph-checkpoint` | Yes | 调试和测试 |
| `SqliteSaver` | `langgraph-checkpoint-sqlite` | No | 轻量 demo |
| `AsyncSqliteSaver` | `langgraph-checkpoint-sqlite` | Yes | 异步小规模 |
| `PostgresSaver` | `langgraph-checkpoint-postgres` | No | 生产全历史 |
| `AsyncPostgresSaver` | `langgraph-checkpoint-postgres` | Yes | 异步生产 |
| `DynamoDBSaver` | AWS 合作 | - | AWS 云原生 |



### 6.4 序列化与安全性

默认序列化器 `JsonPlusSerializer` 使用 msgpack + JSON 混合方案。2026 年 3 月曝出的 **CVE-2026-28277**（CVSS 6.8）正是 msgpack 反序列化的不安全漏洞。

LangGraph 的缓解措施：
- `LANGGRAPH_STRICT_MSGPACK` 环境变量启用严格模式
- `allowed_msgpack_modules` 白名单机制
- 编译 StateGraph 时自动从 schema 推导允许列表



---

## 七、人机协作：Interrupt 与 Command

### 7.1 interrupt() 机制

`interrupt()` 是 2026 年 LangGraph 的一等公民原语，替代了早期 `interrupt_before`/`interrupt_after` 的节点级配置方式。

执行流程：
1. 节点内调用 `interrupt(payload)`，抛出 `GraphInterrupt` 异常
2. 图执行在**精确调用点**暂停
3. 当前状态通过 checkpointer 持久化
4. Payload 返回给调用者（`stream.interrupts` 或 `__interrupt__`）
5. 图无限期等待，直到收到 `Command(resume=...)`
6. Resume 值成为 `interrupt()` 的返回值，节点继续执行

```python
def approval_node(state):
    approved = interrupt("Do you approve this action?")
    return {"approved": approved}

# 恢复
app.invoke(Command(resume=True), config)
```



### 7.2 三种 HITL 模式

| 模式 | 场景 | Resume Payload |
|---|---|---|
| **Approve/Reject** | 敏感操作（发邮件、删数据） | `"approve"` / `"reject"` |
| **Approve/Edit/Reject** | 人类可能需要修改 | `"approve"` / `"reject"` / `{"action": "edit", "correction": {...}}` |
| **Tool-level Routing** | 部分工具自动通过，部分需审核 | 在 review node 内做决策逻辑 |



### 7.3 关键陷阱：Double-Execution

`interrupt()` 在 resume 时会**从头重执行整个节点**。如果 interrupt 之前调用了外部 API 或发送了通知，resume 时会再执行一次。**最佳实践**：将审批逻辑放在独立节点，有副作用的操作放在 `interrupt()` 之后。

---

## 八、流式输出体系

LangGraph 支持多粒度流式输出，通过 `stream` 和 `stream_events` API 暴露：

| 模式 | 内容 | 适用场景 |
|---|---|---|
| **values** | 每次超步后的完整状态快照 | 观察状态演化 |
| **updates** | 仅当前超步中节点返回的增量更新 | 追踪谁在写什么 |
| **messages** | 按消息分组的 ChatModelStream | 逐 token 流式展示 LLM 输出 |
| **custom** | 用户通过 `getWriter()` 写入的任意事件 | 进度条、日志、业务事件 |

内部通过 **StreamMux** 和 **Transformer Pipeline** 处理：
1. `subgraph_discovery` — 发现子图并物化流句柄
2. `lifecycle` — 合成生命周期事件（started/finished/error）
3. `values` — 驱动 `run.values` / `run.output`
4. `messages` — 将 `messages` channel 事件分组为 `ChatModelStream`



---

## 九、多 Agent 架构模式

LangGraph 通过 **Subgraph** 原生支持多 Agent 系统，2026 年已形成完整的模式矩阵：

### 9.1 Supervisor 集中调度

一个 supervisor 节点根据状态决定将任务分发给哪个 worker 子图。Worker 子图拥有独立的 checkpoint 和中断能力。

```python
top = StateGraph(GlobalState)
top.add_node("research", build_research_team())  # 子图作为节点
top.add_node("eng", build_eng_team())
```

### 9.2 Swarm 蜂群去中心化

Agent 间通过消息传递协调，无中央控制器。每个 Agent 是一个子图，通过 `Command(graph=Command.PARENT)` 或共享 channel 通信。

### 9.3 Hierarchical 层级树

多层 supervisor-worker 嵌套，适合复杂组织结构的任务分解。

### 9.4 Reflection 反思质检

Generation Agent 生成内容 → Evaluator Agent 独立评估 → 根据评估结果循环或终止。这与 Anthropic 2026 年提出的三 Agent Harness（Planning/Generation/Evaluator）设计哲学一致。

### 9.5 Debate 对抗辩论

多个 Agent 持有不同观点，通过轮流发言、交叉质询达成共识。

### 9.6 子图状态映射

- **共享键模式**：子图与父图共享部分 state key
- **包装器模式**：子图有独立 state schema，通过节点函数做状态转换
- **BaseStore**：跨 thread 的持久化存储，用于长期记忆共享



---

## 十、编译与运行时内部

### 10.1 compile() 验证

调用 `.compile()` 时，LangGraph 执行三层验证：

1. **孤儿节点检查**：所有节点必须被边引用或作为条件边目标
2. **边目标存在性**：所有边指向的节点必须已注册
3. **START 出边检查**：START 必须有至少一条出边

### 10.2 StateGraph → Pregel 映射

编译后的 `CompiledStateGraph` 继承自 `Pregel`。映射关系：

- **State 字段** → **Channel**（每个字段一个 channel，可选 reducer）
- **Node 函数** → **PregelNode**（实现 Runnable 接口，订阅/写入 channel）
- **普通边** → **Channel 写入**（源节点完成时向目标节点的触发 channel 写入信号）
- **条件边** → **BranchSpec.run()**（运行时读取最新状态，调用 path 函数，向 `branch:to:X` channel 写入）

### 10.3 条件边双策略

LangGraph 内部实现了两种条件路由策略：

- **Strategy A（add_conditional_edges）**：边函数在超步边界执行，读取包含当前节点写入的最新状态
- **Strategy B（Command）**：节点直接返回 `Command(goto=...)`，`_control_branch` 将 goto 字段转为 channel 写入，实现状态更新 + 路由的原子操作

---

## 十一、部署与生产运营

### 11.1 langgraph-cli

本地开发和打包工具，通过 `langgraph.json` 配置依赖、graph 映射和环境变量。

### 11.2 LangGraph Platform

托管部署方案，提供：
- 水平扩展
- Postgres 持久化
- SSE 流式输出
- Webhook 暴露 interrupt
- LangGraph Studio 可视化调试



### 11.3 LangSmith 集成

LangGraph 与 LangSmith 的集成是"零配置"的——每个 PregelNode 自动成为 trace span，包含状态差异、条件边跳转、重试时间线。

---

## 十二、性能特征与"状态税"

### 12.1 Benchmark 数据

在同一基准测试下：

| 指标 | LangGraph | LangChain (LCEL) | 差距 |
|---|---|---|---|
| 平均延迟 | 10,155ms | 6,046ms | **慢 68%** |
| 吞吐 | 2.70 rps | 4.26 rps | **低 37%** |

### 12.2 "状态税"来源

这 4.1 秒的额外延迟不是框架低效，而是**状态税**：
- 每超步需序列化完整 state 到 checkpoint
- Channel 版本跟踪和向量时钟维护
- Pregel 屏障同步开销
- 复杂图拓扑的调度决策

### 12.3 存储写放大

Checkpoint 的存储膨胀可达 **15 倍**（1.5MB 原始状态 → 22.5MB checkpoint 序列化）。原因：
- 每超步保存完整 state snapshot（非增量）
- Msgpack + JSON 双格式冗余
- Channel 版本元数据



### 12.4 选型甜点区

LangGraph 的架构优势在以下场景才显现：
- Agent 步骤 ≥ 5 且需要循环
- 需要 Human-in-the-loop / 断点恢复
- 多 Agent 协作
- 流程需要审计和合规追踪

对于简单线性链（1-2 步 LLM 调用），LCEL 或纯 API 调用更经济。

---

## 十三、安全与序列化

### 13.1 CVE-2026-28277

2026 年 3 月披露的 msgpack 反序列化漏洞，允许攻击者通过构造恶意 checkpoint payload 实现 RCE。根本原因是 `JsonPlusSerializer` 默认允许重建任意 msgpack ext 类型。

### 13.2 防御机制

- **严格模式**：`LANGGRAPH_STRICT_MSGPACK=1` 仅允许内置安全类型
- **自动推导白名单**：编译 StateGraph 时从 schema 自动提取允许类型
- **显式配置**：`allowed_msgpack_modules=[(module, class_name), ...]`



---

## 十四、局限性与选型边界

### 14.1 结构性局限

1. **Cloud-first 默认**：免费/Plus 层无法自托管，数据必须出域。Enterprise 才有 VPC/混合部署。
2. **非 LangChain 栈的"二等公民"**：虽然 SDK 支持任意代码，但 trace 可视化、节点图、状态 diff 等核心优势在非 LangChain 应用上大幅削弱。
3. **大规模 Trace UI 延迟**：当单个 Agent 运行包含数十个递归步骤时，LangSmith 的 UI 渲染会出现明显卡顿。
4. **陡峭学习曲线**：需要理解图论、Pregel、channel/reducer 等概念，简单 Agent 的样板代码量高于 CrewAI 等高层框架。

### 14.2 使用反模式

- **过度设计简单流程**：3 步以内的线性链不需要 LangGraph
- **忽视 reducer 冲突**：多个节点写同一字段无 reducer 会导致静默覆盖
- **在 interrupt 前放副作用**：resume 时整个节点重执行，副作用会重复
- **全量 checkpoint 不清理**：生产环境需设置 checkpoint 保留策略，避免存储无限膨胀

---

## 总结

LangGraph 的技术架构可以概括为 **"Pregel BSP 引擎 + 状态机图模型 + 双 API 封装"** 的三层结构：

| 层级 | 组件 | 核心价值 |
|---|---|---|
| **运行时** | Pregel、Channels、Supersteps | 确定性执行、无竞态、可恢复 |
| **图模型** | StateGraph、Nodes、Edges、Reducers | 显式控制流、类型安全、循环原生 |
| **应用层** | Functional API、Subgraphs、Interrupt | 开发效率、人机协作、多 Agent 编排 |

它的设计取舍非常明确：**用 68% 的延迟代价和 15 倍的存储膨胀，换取生产级 Agent 所需的持久化、可恢复性、可审计性和人机协作能力**。当你的 Agent 需要 survive 第一个 10,000 个真实用户时，这些"税"是必要成本；但如果你只是在搭原型，这个税可能过重。
