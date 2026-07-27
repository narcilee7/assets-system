# Plan-and-Execute

## 核心模块

```plain
┌─────────────────────────────────────────────┐
│           Plan-and-Execute Runtime            │
├─────────────────────────────────────────────┤
│ 1. Planner（计划生成器）                      │
│    └─ 输入：用户目标 + 可用工具 + 历史记忆      │
│    └─ 输出：DAG 计划（节点 + 依赖边）           │
│                                               │
│ 2. Scheduler（调度器）                        │
│    └─ 拓扑排序、并行调度、资源分配              │
│                                               │
│ 3. Executor（执行器）                         │
│    └─ 节点执行、工具调用、SubAgent 委派         │
│                                               │
│ 4. State Manager（状态机）                    │
│    └─ 节点状态：PENDING → RUNNING → SUCCESS   │
│                   → FAILED → RETRYING → SKIP  │
│                                               │
│ 5. Verifier（验证器）                         │
│    └─ 节点输出校验、结果一致性检查              │
│                                               │
│ 6. Recovery（恢复器）                         │
│    └─ 重试、回滚、重新规划、人工介入            │
│                                               │
│ 7. Checkpoint（检查点）                       │
│    └─ 计划快照、状态持久化、断点续传            │
└─────────────────────────────────────────────┘
```
## Scheduler：拓扑排序、并行调度、资源分配

## Executor：节点执行与SubAgent委派

| 类型             | 执行方式            | Phus 映射             |
| -------------- | --------------- | ------------------- |
| **Tool Call**  | 直接调用工具函数        | Phus 的"工具调用"        |
| **LLM Call**   | 调用 LLM 生成内容     | Phus 的"Prompt 构建"   |
| **SubAgent**   | 委派子 Agent 执行子任务 | Phus 的"SubAgent 委派" |
| **Human**      | 等待人工确认          | 可能用于高风险操作           |
| **Sleep/Wait** | 定时等待            | Phus 的"Cron 调度"     |

### SubAgent委派的关键设计

```plain
父 Agent: "帮我写一个爬虫"
  → Planner 生成计划：n1=分析需求, n2=写代码(SubAgent), n3=测试代码
  → n2 委派给 CodeWriter Agent
    → CodeWriter 有自己的 Planner + Executor
    → CodeWriter 完成后返回结果 + 状态
  → 父 Agent 的 Verifier 检验代码质量
    → 通过 → n3 执行测试
    → 失败 → 返回 CodeWriter 重试，或升级给父 Agent 重新规划
```

SubAgent：
  - 进程内：共享内存、通信快、崩溃会波及父Agent
  - 进程外：隔离性好，独立运行，但是通信延迟高
  - 建议：轻量 SubAgent 进程内，重任务（代码执行、文件操作）进程外沙箱

- 上下文隔离

### 状态机设计

```plain
PENDING → RUNNING → SUCCESS
   ↓         ↓        ↓
RETRYING ← FAILED   CANCELLED
   ↓
(超过重试次数) → TERMINAL_FAILED
```

全局计划状态：
- RUNNING：至少一个节点 RUNNING，无 FAILED
- PARTIAL_SUCCESS：部分节点 SUCCESS，部分 FAILED 但已跳过
- SUCCESS：所有 exit_nodes SUCCESS
- FAILED：关键路径节点 TERMINAL_FAILED
- PAUSED：用户主动暂停或触发 checkpoint


### Verifier

| 层级        | 校验内容            | 实现方式                         |
| --------- | --------------- | ---------------------------- |
| **格式校验**  | 输出是否符合预期 Schema | JSON Schema / Zod / Pydantic |
| **语义校验**  | 结果是否合理          | 规则引擎 / 轻量 LLM 评判             |
| **一致性校验** | 与计划目标是否一致       | 父 Agent 的 Verifier 模块        |
| **安全校验**  | 是否包含敏感信息 / 恶意内容 | 关键词过滤 / 分类模型                 |

Verifier 也是 LLM，它错了怎么办？
- 多层校验：规则引擎先筛，LLM 后审，不一致时人工介入
- 置信度阈值：Verifier 输出置信度 < 0.8 时，标记为待审核，不自动通过
- 基线对比：与历史成功任务的输出分布对比，异常值触发告警

### 错误恢复策略

| 失败类型       | 策略            | 实现                     |
| ---------- | ------------- | ---------------------- |
| **节点执行失败** | 重试（指数退避）      | 最多 3 次，间隔 1s → 2s → 4s |
| **节点输出错误** | 重新规划（Re-plan） | Planner 根据当前状态重新生成子计划  |
| **依赖断裂**   | 跳过或阻塞         | 非关键依赖跳过，关键依赖阻塞         |
| **计划过时**   | 全局重新规划        | 环境变化导致原计划不可行，从头规划      |
| **无法恢复**   | 人工介入 / 优雅降级   | 通知用户，提供已完成的中间结果        |

## Checkpoint：持久化与断点续传

```json
{
  "plan_id": "plan_123",
  "plan_dag": {...},
  "node_states": {"n1": "SUCCESS", "n2": "RUNNING", "n3": "PENDING"},
  "node_outputs": {"n1": {...}, "n2": "partial_result..."},
  "context_snapshot": "会话上下文摘要",
  "timestamp": "2026-07-26T19:23:00Z",
  "version": "v1.2"
}
```
