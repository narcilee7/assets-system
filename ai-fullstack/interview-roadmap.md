# AI Fullstack 面试综合题

这些题目横跨多个模块，用于考察候选人对 AI 应用全链路的系统设计能力。

---

## 综合题一：设计一个能调用工具的客服 Agent

### 题目

用户输入：「我要退掉昨天买的那个相机，订单号是 12345」。

要求：
- Agent 需要理解意图、提取订单号。
- 查询订单状态和退款规则。
- 判断是否符合退款条件。
- 调用退款工具（有副作用）。
- 流式展示思考过程、工具状态、最终结果。
- 高金额退款需要人工确认。
- 全程可追踪、可评估。

### 参考答案要点

**1. 模块划分**

```text
Streaming UI ←→ Agent Runtime ←→ Tool Calling ←→ 订单/支付服务
                ↓        ↓
              Memory   Safety
                ↓
           Observability / Eval
```

**2. 数据流**

- 用户输入进入 Agent Runtime，创建 session。
- Planner 生成 plan：
  1. 调用 `get_order(order_id=12345)`。
  2. 调用 `check_refund_policy(order)`。
  3. 如果符合条件，调用 `refund_order(order_id)`。
- 每步状态通过 event stream 推送给 Streaming UI。
- `refund_order` 是 high-risk 工具，触发 Safety confirmation gate。
- 确认后执行，结果返回 Agent，生成最终回复。

**3. 关键设计点**

- Tool schema 要清晰：`get_order` / `check_refund_policy` / `refund_order` 的参数和返回值。
- `refund_order` 需要 idempotency key，防止重复退款。
- Confirmation gate 展示订单信息、退款金额、影响范围。
- 所有 tool call 记录 trace span。
- Eval golden set 包含：符合退款、不符合退款、高金额需确认、订单不存在、用户取消。

**4. 深度追问**

- 如果 `refund_order` 调用超时怎么办？（查询支付状态；若成功则返回成功；若未执行则重试。）
- 用户说「昨天买的相机」但没给订单号怎么办？（Agent 调用 `list_recent_orders` 让用户选择。）
- 客服人员和 Agent 同时处理同一个退款请求怎么办？（订单状态锁或乐观锁。）

---

## 综合题二：如何评估并持续改进一个 RAG 系统？

### 题目

公司内部知识库问答系统上线后，用户反馈「有时答非所问，有时找不到答案」。如何建立评估体系和改进闭环？

### 参考答案要点

**1. 评估维度**

- **Retrieval**：recall@k、precision@k、NDCG。
- **Answer**：faithfulness、relevance、completeness、correctness。
- **Citation**：citation precision / recall。
- **User**：满意度、采纳率、纠错率。

**2. Golden Set 构建**

- 从线上 query 中抽样。
- 覆盖：能找到的、找不到的、需要综合多文档的、需要拒答的。
- 每个 case 标注期望检索文档和期望回答要点。

**3. 诊断流程**

```text
Bad Case
  → 检索没召回？→ 调 chunk / embedding / hybrid search
  → 召回了但排序低？→ 加 reranker
  → 检索对但答案错？→ 调 prompt / citation / temperature
  → 应该拒答但乱答？→ 加 confidence threshold
```

**4. 改进闭环**

- 每周跑 eval，生成退化报告。
- 把 bad case 分类，进入 backlog。
- 文档更新后自动重索引。
- A/B test 新策略。

**5. 深度追问**

- 用户满意度高但 eval score 低，信哪个？（两者都看；eval 是筛选器，用户反馈是最终标准。）
- 如何低成本持续 eval？（rule-based judge 先筛，LLM judge 只做模糊 case。）

---

## 综合题三：Agent 调用支付工具时如何保证安全与幂等？

### 题目

Agent 接到用户指令「给张三转账 1000 元」。设计从意图理解到实际扣款的全链路安全和幂等方案。

### 参考答案要点

**1. 安全层**

- Intent 识别：确认转账金额、收款人。
- Policy check：用户是否有转账权限、收款人是否在白名单、金额是否超限。
- Confirmation gate：展示「向张三转账 1000 元」，要求用户二次确认（密码/指纹/短信验证码）。
- 输出侧校验：tool call 参数通过 policy engine 再次校验。

**2. 幂等层**

- 生成唯一 idempotency key，绑定 session 和 tool call。
- 执行前查状态：
  - 已执行成功 → 返回结果。
  - 已执行失败 → 重试。
  - 未执行 → 调用支付网关。
- 支付网关本身也支持幂等。
- 超时后先查询支付状态，不盲目重试。

**3. 审计**

- 记录：用户、收款人、金额、idempotency key、确认 token、结果。
- 审计日志只追加、独立存储。

**4. 深度追问**

- 用户确认后网络断开，再次进入 session 怎么办？（从 checkpoint 恢复；若已确认则继续执行；若未确认则重新确认。）
- 模型把「张三」识别成错误的人怎么办？（收款人选择用 id，展示全名和账号后四位。）

---

## 综合题四：设计一个支持人工审批的退款工作流

### 题目

电商退款流程：用户申请退款 → 查订单 → 自动审核（金额 < 500 自动退，≥500 人工审批）→ 调支付网关 → 通知用户。

### 参考答案要点

**1. Workflow 定义**

```yaml
steps:
  - id: get_order
    type: tool
    tool: get_order
  - id: auto_review
    type: condition
    if: order.amount < 500
    then: refund
    else: human_approval
  - id: human_approval
    type: approval
    assignee: refund_team
    timeout: 24h
  - id: refund
    type: tool
    tool: refund_order
  - id: notify
    type: tool
    tool: send_notification
```

**2. 关键点**

- 每个 step 有 idempotency key 和 checkpoint。
- 审批节点超时后自动升级或拒绝。
- 支付网关调用支持幂等。
- 失败时执行补偿：已退款但通知失败可重试通知；未退款则无需补偿。

**3. 与 Agent 的关系**

- 用户触发工作流的方式可以是自然语言：Agent 解析后启动 workflow instance。
- Workflow 执行过程中的事件流回传给 UI。

**4. 深度追问**

- 审批人驳回了怎么办？（workflow 进入通知用户 step，结束。）
- 用户在工作流执行中取消怎么办？（保存 checkpoint；已执行的不可逆操作不可取消；未执行的 step 停止。）

---

## 综合题五：AI 应用上线后质量下降，怎么排查？

### 题目

一个 Agent 产品上线一个月后，用户投诉增多。老板要求你一周内定位问题并给出改进方案。

### 参考答案要点

**1. 数据收集**

- 拉取最近 30 天 trace、metric、eval、用户反馈。
- 按时间看 trend：latency、error rate、eval score、fallback rate、cost。

**2. 分层定位**

- **Model 层**：模型是否被替换？temperature 是否变化？输出质量是否下降？
- **Tool 层**：工具失败率是否上升？下游服务是否变慢？参数错误是否增多？
- **RAG 层**：检索召回是否变差？文档是否陈旧？chunk 策略是否被改？
- **Prompt 层**：是否有 prompt 变更导致行为变化？
- **用户层**：是否有新用户群体、新 query pattern？

**3. 优先修复**

- 快速修复：fallback 策略、超时设置、错误提示。
- 中期修复：更新 golden set、优化 prompt、调整 router。
- 长期修复：重构 planner、加强 eval、建立 regression。

**4. 深度追问**

- 怎么证明是模型质量下降而不是用户期望变高？（对比同一批 query 在新旧版本上的 eval score。）
- 如果所有指标都正常但用户不满意怎么办？（补充 qualitative analysis：看具体 bad case、用户访谈。）

---

## 面试应答框架

遇到 AI Fullstack 系统设计题时，按以下结构回答：

1. **澄清需求**：用户量、延迟要求、成本预算、安全等级。
2. **画出模块**：Agent / Tool / RAG / Memory / Eval / Safety / Observability。
3. **描述数据流**：从用户输入到最终输出的完整链路。
4. **强调失败路径**：超时、错误、取消、越权、幻觉。
5. **谈可观测和 Eval**：如何知道系统好不好，如何持续改进。
6. **谈安全和边界**：权限、确认、审计、数据隔离。
7. **谈扩展性**：数据量增长、模型升级、新功能接入。
