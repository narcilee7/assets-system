# Workflow Orchestration 面试深度问答

## 核心概念地图

1. **Workflow**：预定义的、有明确步骤和依赖的任务流程。
2. **DAG**：有向无环图，描述步骤之间的依赖关系。
3. **Step**：工作流中的原子单元，有输入、输出、状态。
4. **Checkpoint**：工作流执行过程中的持久化状态，用于恢复。
5. **Retry / Backoff**：步骤失败后的重试策略。
6. **Human Approval**：需要人工确认的步骤节点。

## 架构与数据流

```text
Workflow Definition (YAML / JSON / Code)
  → Parser（解析为 DAG）
    → Scheduler（按依赖调度）
      → Step Executor
        → Tool / LLM / Human Gate
          → State Update
            → Checkpoint Save
              → Next Steps
```

## 关键设计决策

### 1. Workflow 和 Agent 的区别？

| 维度 | Workflow | Agent |
| --- | --- | --- |
| 规划 | 人预定义 | 模型动态规划 |
| 可解释性 | 高 | 中低 |
| 灵活性 | 低 | 高 |
| 确定性 | 高 | 低 |
| 适用 | 审批、报销、退款 | 开放探索、客服 |

**结论**：确定性流程用 Workflow，探索性任务用 Agent；两者可结合（Agent 生成 workflow，workflow 执行确定流程）。

### 2. Step 状态怎么设计？

```text
pending → running → completed
              ↓
            failed → retrying → completed / skipped / terminal_failed
              ↓
        awaiting_approval → approved → running
```

### 3. DAG 调度怎么做？

- 拓扑排序得到执行顺序。
- 维护每个 step 的依赖状态：所有前置 step completed 才可执行。
- 支持并行执行无依赖的 step。
- 检测环，防止死循环。

### 4. Checkpoint 保存什么？

- workflow instance id。
- 每个 step 的输入、输出、状态、重试次数。
- 全局变量 / context。
- 审批记录。
- 创建/更新时间。

### 5. 重试策略

- **固定间隔**：每次等 N 秒。
- **指数退避**：1s, 2s, 4s, 8s...
- **带抖动**：避免惊群。
- **最大重试次数**：超过后标记失败。
- **可重试错误 vs 致命错误**：只重试 retryable 错误。

## 失败路径与恢复

| 失败 | 原因 | 恢复 |
| --- | --- | --- |
| Step 失败 | 工具错误、LLM 错误 | 按策略重试；失败后可 fallback 或终止 |
| 依赖未满足 | DAG 配置错误 | 校验 workflow 定义，拒绝启动 |
| 死锁 | 环状依赖 | 启动前拓扑排序检测环 |
| 长时间挂起 | 审批人未响应 | 设置审批超时，转交或自动拒绝 |
| Checkpoint 丢失 | 存储故障 | 多副本持久化；丢失后从上一个 checkpoint 恢复 |
| 幂等失败 | 同一 instance 被多次触发 | instance 级别去重；step 级别幂等 |
| 数据不一致 | 部分 step 成功部分失败 | 补偿事务 / saga；或人工介入 |

## 面试题与应答脚本

### Q1：Workflow 和 Agent 怎么配合使用？

**答**：
- 对于确定性流程（如退款审批），用 Workflow 保证可控和可审计。
- 对于需要理解意图、选择路径的环节，用 Agent 做前置理解，生成 workflow 参数。
- 例如：用户说「我要退款」→ Agent 理解意图并提取订单号 → 触发退款 Workflow → Workflow 执行查订单、审规则、调支付、通知用户。

**追问**：
- Agent 生成的 workflow 不可靠怎么办？（生成的 workflow 需要 schema 校验；高风险参数需要人工确认。）
- Workflow 里能不能嵌套 Agent？（可以；某个 step 可以是 Agent 调用。）

### Q2：Workflow 的 Step 状态机怎么设计？

**答**：
- pending：等待调度。
- running：正在执行。
- completed：成功完成。
- failed：执行失败，等待重试或处理。
- retrying：正在重试。
- skipped：因条件判断跳过。
- awaiting_approval：等待人工审批。
- terminal_failed：重试耗尽， workflow 失败。

**追问**：
- 跳过和失败有什么区别？（skip 是预期行为；fail 是异常。）
- 一个 step 失败后，后续 step 怎么办？（默认终止；也可配置 continue-on-error 或 fallback branch。）

### Q3：如何保证 Workflow 的幂等性？

**答**：
- 每个 workflow instance 有唯一 ID。
- 触发时先去重：已存在的 instance 直接返回。
- 每个 step 执行也带 idempotency key。
- 下游工具也支持幂等。
- 恢复时从 checkpoint 继续，不重复执行已完成 step。

**追问**：
- 如果 instance ID 由调用方生成，冲突怎么处理？（返回已有 instance 状态；或要求调用方用新 ID。）
- step 部分执行后崩溃，恢复时会重复吗？（不会，因为 checkpoint 记录了 step 状态；恢复后只执行未完成的。）

### Q4：Checkpoint 什么时候保存？

**答**：
- 每个 step 开始前保存（确保可恢复）。
- 每个 step 完成后保存（记录结果）。
- 审批节点前后保存（记录审批状态）。
- 关键变量变更后保存。

**追问**：
- 保存太频繁会不会影响性能？（会；可批量保存或异步保存。）
- Checkpoint 存在哪里？（数据库、S3、etcd；需要高可用。）

### Q5：人工审批节点怎么设计？

**答**：
- Step 状态变为 `awaiting_approval`。
- 发送通知给审批人（邮件/IM/工作台）。
- 审批人通过 UI 审批，系统更新状态为 approved / rejected。
- 设置超时：超时后可自动转交、升级或拒绝。
- 记录审批人、时间、意见到 audit log。

**追问**：
- 审批人休假怎么办？（设置代理审批人或升级机制。）
- 审批期间 workflow 占不占资源？（不占执行资源，只保存状态。）

### Q6：DAG 中出现环怎么办？

**答**：
- 在 workflow 定义阶段做拓扑排序检测环。
- 发现环则拒绝部署。
- 运行时通过状态机保证不会无限循环（每个 step 有执行次数限制）。

**追问**：
- 如果业务上需要循环怎么办？（用迭代 step 或子 workflow，明确循环条件和最大次数。）
- 动态生成的 DAG 怎么检测环？（每次生成后做拓扑排序验证。）

### Q7：Workflow 如何处理长时间运行的任务？

**答**：
- Step 执行异步化：启动任务后立即保存 checkpoint，任务完成后回调。
- 支持 polling 模式：定期查询外部任务状态。
- 设置 step 超时，超时可重试或失败。
- 使用事件驱动：外部系统完成任务后发送事件触发 workflow 继续。

**追问**：
- 异步任务回调时怎么找到对应 workflow instance？（callback 带 instance_id 和 step_id。）
- 外部任务完成了但回调丢失怎么办？（polling 作为兜底。）

### Q8：Workflow 和 Saga 有什么关系？

**答**：
- Saga 是一种处理长事务的模式，把大事务拆成多个本地事务，每个本地事务有补偿操作。
- Workflow 可以实现 Saga：每个 step 是一个本地事务，失败时执行 compensation step。
- Workflow 更通用；Saga 更专注于分布式事务一致性。

**追问**：
- 补偿操作一定能成功吗？（不一定；需要监控和人工介入。）
- 补偿和重试怎么选择？（ transient 错误重试；业务失败或不可逆转操作需要补偿。）

### Q9：如何设计 Workflow 的并行执行？

**答**：
- 解析 DAG，找出无依赖的 step。
- 用线程池/进程池/消息队列并行调度。
- 限制最大并行度，防止资源打满。
- 收集所有并行 step 结果后，再执行下游 step。

**追问**：
- 并行 step 修改同一个变量怎么办？（避免共享可变状态；用局部结果合并。）
- 一个并行分支失败，其他分支怎么办？（可配置：全部取消或继续执行后统一处理。）

### Q10：Workflow 的版本管理怎么做？

**答**：
- workflow definition 版本化，启动 instance 时绑定版本。
- 已运行的 instance 保持原版本，新 instance 用新版本。
- 支持版本对比和回滚。
- 迁移中的 instance 需要特殊处理（通常不迁移，自然结束）。

**追问**：
- 如果新版本改了 step 依赖，老 instance 怎么办？（老 instance 按原版本执行完；新 instance 用新定义。）
- 怎么保证版本兼容性？（版本变更要经过回归测试；breaking change 要显式标注。）

## 开放设计题

1. **设计一个退款审批 Workflow**：包含查订单、审规则、调支付网关、通知用户、人工审批（高金额）。说明状态机、checkpoint、补偿、审批超时处理。

2. **设计一个数据 ETL Workflow**：从多个数据源抽取、转换、加载到数仓。支持依赖、并行、重试、断点续传。说明 DAG 调度和错误恢复。

3. **设计一个 Agent 生成 Workflow 的系统**：用户用自然语言描述流程，Agent 输出 workflow YAML。说明如何验证生成的 workflow、如何处理歧义、如何保证安全。

## 与其他模块的关系

- **Agent Runtime**：Agent 可以触发 Workflow，Workflow 中也可嵌套 Agent step。
- **Tool Calling**：Workflow 的 step 通常调用 Tool。
- **Safety**：高风险 step 需要 Safety 的 policy 和 approval。
- **Observability**：Workflow 的执行轨迹需要 trace。
- **Eval**：Workflow 的 completion、latency、recovery 是 eval 指标。
- **Memory**：Workflow 上下文可存入 Memory，供后续 session 使用。
