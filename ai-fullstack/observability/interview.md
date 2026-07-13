# Observability 面试深度问答

## 核心概念地图

1. **Trace**：一次完整请求的调用链。
2. **Span**：Trace 中的单个操作单元，包含开始时间、持续时间、标签、事件。
3. **Metric**：可聚合的数值指标，如 latency、token count、error rate。
4. **Log**：离散事件记录，如 prompt、completion、error。
5. **Eval**：与 Trace 关联的质量评估结果。
6. **Dashboard**：可视化展示系统状态和趋势。

## 架构与数据流

```text
AI Application
  → Instrumentation（埋点）
    → Collector（收集）
      → Storage（Trace / Log / Metric DB）
        → Query / Analysis
          → Dashboard / Alert
            → Human Investigation
```

## 关键 Span 类型

| Span | 字段 | 用途 |
| --- | --- | --- |
| model_call | model, prompt_hash, completion_hash, tokens_in, tokens_out, latency, cost | 模型调用成本和性能 |
| tool_call | tool_name, args_hash, result_hash, status, latency, retry_count | 工具执行追踪 |
| retrieval | query, top_k, doc_ids, scores, latency | RAG 检索效果 |
| planner | plan, step_count, model, latency | Agent 规划质量 |
| agent_step | step_id, status, input, output | Agent 执行细节 |
| eval | case_id, metric, score, judge | 质量评估关联 |

## 关键设计决策

### 1. Trace 怎么串联？

- 使用 trace_id 贯穿整个请求。
- 每个 span 有 parent_id，形成树状结构。
- 在 HTTP header 或消息元数据中传递 trace context。
- 异步任务（如 tool call）也要继承 trace context。

### 2. Prompt 和 Completion 要不要记录？

- **必须记录**：用于 debug、eval、audit。
- **但要注意**：
  - PII 脱敏。
  - 设置保留期。
  - 访问权限控制。
  - 日志中避免记录 API key、密码。

### 3. Metric 怎么设计？

- **Latency**：P50 / P95 / P99，按 model / operation 分维度。
- **Token**：input / output tokens，按 tenant / user / model 聚合。
- **Cost**：单价 × token 数，用于预算控制。
- **Quality**：eval score 趋势。
- **Error**：error rate，按 error type 分类。

### 4. Trace 和 Eval 怎么关联？

- Eval 运行时用同样的 trace_id。
- 在 eval report 中可下钻到具体 trace。
- 对失败 case，直接定位到是哪个 span 出问题。

## 失败路径与恢复

| 失败 | 原因 | 恢复 |
| --- | --- | --- |
| 埋点丢失 | 异步任务未传递 trace context | 强制 context 传播；对丢失的 trace 兜底生成新 trace_id |
| 采样率过低 | 为了省钱少采样 | 关键路径 100% 采样，普通路径按错误或 tenant 采样 |
| 数据量过大 | trace 太多 | 调整采样、聚合 metric、设置 retention |
| 敏感信息泄露 | prompt 含 PII | 脱敏、访问控制、加密存储 |
| 告警噪音 | 阈值设置过松/过紧 | 用动态阈值、异常检测、分群告警 |
| Dashboard 延迟 | 存储查询慢 | 预聚合、分层存储、cache |
| Trace 与业务日志对不齐 | 时间不同步或 ID 不一致 | 统一 clock 和 ID 生成策略 |

## 面试题与应答脚本

### Q1：AI 应用的可观测性和传统应用有什么不同？

**答**：
- 传统应用关注请求、错误、延迟、资源。
- AI 应用还要关注：prompt、completion、token、model、tool call、retrieval、eval score。
- AI 的输出不确定，需要把质量指标也纳入可观测。
- 成本和延迟与模型选择强相关。

**追问**：
- Prompt 算不算 PII？（可能算，如果包含用户个人信息。）
- Completion 要不要记录？（要，但脱敏；是 debug 和 eval 的关键。）

### Q2：Trace 应该包含哪些 Span？

**答**：
- 顶层：session / request。
- 模型层：model_call（可嵌套多个）。
- 工具层：tool_call（含参数、结果、重试）。
- 检索层：retrieval（query、top-k、score）。
- 规划层：planner / agent_step。
- 评估层：eval。

**追问**：
- Span 粒度多细合适？（太粗定位不到问题；太细数据量大。按业务关键点拆分。）
- 一个请求调用多次模型，怎么展示？（每个 model_call 是独立 span，共享 parent session span。）

### Q3：如何计算一次 AI 请求的成本？

**答**：
- 记录 model_call span 中的 tokens_in 和 tokens_out。
- 根据模型单价计算：cost = tokens_in × input_price + tokens_out × output_price。
- 按 trace 汇总所有 model_call 成本。
- 加上工具调用、检索、存储的间接成本。

**追问**：
- 不同模型商单价不同，怎么统一？（维护价格表；实际计费以账单为准。）
- 缓存命中的请求成本怎么算？（缓存成本单独算；可记为 near-zero model cost。）

### Q4：Prompt 日志如何保护隐私？

**答**：
- 对 PII 做实体识别和脱敏（如把手机号替换为 `[PHONE]`）。
- 设置日志保留期（如 30 天）。
- 访问日志需要权限审批。
- 审计日志访问记录。
- 对极敏感场景，只记录 hash 不记录原文。

**追问**：
- 脱敏会不会影响 debug？（会；可在严格授权下查看原始日志。）
- Hash 能不能用于 eval？（不能；eval 需要原始 prompt/completion，要在受控环境。）

### Q5：Latency P99 高怎么定位？

**答**：
- 按 span 拆解 latency：model_call、tool_call、retrieval 各占多少。
- 看是哪个 model 或 tool 慢。
- 看是否有特定 tenant / user / query pattern 导致长尾。
- 结合 trace 查看是否有串行调用过多、重试次数过多。

**追问**：
- P99 和平均值哪个更重要？（P99 反映最差用户体验，通常更重要。）
- 长尾延迟怎么优化？（缓存、并行化、模型降级、超时控制。）

### Q6：如何把 Eval 结果和 Trace 关联？

**答**：
- Eval 运行时复用生产 trace_id，或在 eval report 中记录对应 trace_id。
- Dashboard 支持从 eval score 下钻到 trace。
- 对低分 case，分析相关 span 找到根因。

**追问**：
- 生产 trace 能不能直接用于 eval？（可以，但 eval 通常用 golden set 在离线环境重跑。）
- Trace 数据量大，eval 怎么快速找 bad case？（按 score 排序、按 category 过滤。）

### Q7：采样策略怎么设计？

**答**：
- 关键路径（支付、高风险工具）100% 采样。
- 普通请求按 1% 或 10% 采样。
- 错误请求 100% 采样。
- VIP tenant 或新功能灰度期间提高采样率。

**追问**：
- 采样会不会漏掉关键问题？（会；所以要保证错误和异常全采。）
- 动态采样怎么做？（根据当前系统负载、错误率自动调整采样率。）

### Q8：Alert 应该关注哪些指标？

**答**：
- Error rate 突增。
- Latency P95/P99 恶化。
- Token cost 异常增长。
- Fallback rate 升高。
- Eval score 下降。
- Rate limit 接近上限。
- Safety violation 发生。

**追问**：
- 告警阈值怎么设？（基于历史基线 + 业务容忍度；用动态阈值减少噪音。）
- 告警后怎么快速定位？（Dashboard 预置 drill-down 视图，关联 trace。）

### Q9：多租户场景下 Observability 怎么做？

**答**：
- 每个 span/metric/log 带 tenant_id / user_id 标签。
- Dashboard 支持按 tenant 过滤和对比。
- 配额和成本按 tenant 聚合。
- 数据隔离：一个 tenant 不能看到另一个 tenant 的 trace。

**追问**：
- tenant 数量很多，标签基数爆炸怎么办？（高基数标签单独存储；聚合时用低基数标签。）
- 共享基础设施的 trace 怎么归属 tenant？（在入口处打上 tenant 标签，后续 span 继承。）

### Q10：如何设计一个 AI 可观测性 Dashboard？

**答**：
- 顶层：请求量、latency、error rate、cost、eval score 趋势。
- 中间层：按 model / tool / operation 拆解。
- 底层：单条 trace 的 span 瀑布图、prompt/completion 详情。
- 支持按时间、tenant、model、error type 过滤。

**追问**：
- Dashboard 更新频率？（metric 可 1 分钟；trace 实时；eval 可每小时/每天。）
- 谁看这个 Dashboard？（工程师看 debug，PM 看质量，财务看成本。）

## 开放设计题

1. **设计一个 AI 应用的统一可观测平台**：需要采集 trace、metric、log、eval，支持多模型、多租户、成本控制。说明数据模型、采集方式、存储选型、Dashboard。

2. **设计一个 Prompt 泄露检测系统**：发现日志或 trace 中意外记录了 API key、密码、PII。说明检测规则、脱敏流程、告警机制。

3. **设计一个 Eval 驱动的根因分析工具**：某个 eval metric 下降，系统自动分析哪些 span / model / tenant 导致。说明算法和交互。

## 与其他模块的关系

- **Agent Runtime / Tool Calling / RAG**：这些模块产生 span，是 Observability 的数据源。
- **Model Serving**：Model latency、cost、fallback 需要 Observability 监控。
- **Eval**：Eval 结果需要与 Trace 关联，形成质量闭环。
- **Safety**：Safety violation 需要被记录和告警。
- **Streaming UI**：UI 上可展示 trace 摘要，如「正在调用工具 X」。
- **Memory**：Memory 的 retrieval 和 update 也需要 trace。
