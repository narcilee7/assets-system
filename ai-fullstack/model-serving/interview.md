# Model Serving 面试深度问答

## 核心概念地图

1. **Router**：根据请求特征选择最合适的模型。
2. **Fallback**：主模型失败时切换到备用模型。
3. **Quota / Rate Limit**：控制成本和防止滥用。
4. **Latency**：从请求到首 token / 完整响应的时间。
5. **Cost**：Token 消耗和模型单价决定调用成本。
6. **Cache**：重复或相似请求的缓存，降低成本和延迟。

## 架构与数据流

```text
Client Request
  → Gateway（auth / rate limit）
    → Router（task / latency / cost / quality）
      → Primary Model
        ← Success / Failure
      → Fallback Model（如果需要）
    ← Response / Error
  → Metrics Collector
```

## 关键设计决策

### 1. Router 策略有哪些？

| 策略 | 依据 | 适用 |
| --- | --- | --- |
| Task-based | 任务类型 | 简单分类，如代码任务 → code model |
| Latency-based | 当前延迟 | 实时性要求高的场景 |
| Cost-based | 预算 | 内部工具、低优先级任务 |
| Quality-based | 任务难度 | 复杂推理 → 大模型 |
| Load-based | 模型负载 | 避免某个模型过载 |
| MoE / Cascade | 小模型先尝试，不行再上大模型 | 成本敏感场景 |

### 2. Fallback 怎么设计？

- **错误码触发**：5xx、timeout、rate limit。
- **降级模型**：从 GPT-4 → GPT-3.5 → 本地模型。
- **功能降级**：从流式输出 → 一次性输出 → 缓存回答。
- **熔断**：连续失败后短时间不再调用该模型。

### 3. Quota 控制粒度

- **Global**：整个应用的 token 预算。
- **Tenant**：每个客户/团队的配额。
- **User**：每个用户的配额。
- **Feature**：某个功能的配额。
- **Model**：某个模型的配额。

### 4. Latency 优化

- **Streaming**：边生成边返回，降低首 token 时间（TTFT）。
- **Caching**：语义缓存或精确缓存常见 query。
- **Prefetching**：预加载可能需要的资源。
- **Speculative Decoding**：小模型 draft + 大模型验证。
- **Batching**：合并多个请求提高吞吐。
- **Model Quantization**：降低推理延迟和成本。

## 失败路径与恢复

| 失败 | 原因 | 恢复 |
| --- | --- | --- |
| 模型超时 | 模型负载高或生成长 | fallback、重试、缩短生成长度 |
| 模型返回错误 | 服务商故障 | fallback 到备用服务商 |
| Rate limit | 配额用完 | 排队、降级、提示用户 |
| 成本超预算 | token 消耗大 | 切换 cheaper model、限制输出长度 |
| 输出质量差 | 模型不适合任务 | router 换模型、prompt 优化 |
| Cache 失效 | 缓存命中率低 | 分析 query 模式，优化缓存策略 |
| 路由决策错误 | router 逻辑有 bug | 灰度 + shadow traffic 验证 |

## 面试题与应答脚本

### Q1：模型路由有哪些策略？怎么选？

**答**：
- 简单场景按任务路由：代码任务 → code model，聊天任务 → chat model。
- 复杂场景按质量/成本/延迟综合打分：实时性要求高选延迟低的，复杂推理选能力强的。
- 还可以用 cascade：先用小模型尝试，置信度低再上大模型。

**追问**：
- cascade 怎么判断「小模型不行」？（看置信度、答案自检、或特定任务的成功率。）
- 路由决策本身消耗大吗？（通常很小；若用模型做路由，需考虑成本。）

### Q2：Fallback 和重试有什么区别？

**答**：
- **重试**：同一模型再次调用，适用于 transient 错误（网络抖动、超时）。
- **Fallback**：换另一个模型/服务，适用于该模型持续不可用或配额用完。

**追问**：
- Fallback 链可以有多长？（通常 2-3 层；太长会增加延迟和复杂度。）
- 所有模型都失败怎么办？（返回错误；或返回缓存的兜底回答。）

### Q3：怎么控制 Token 成本？

**答**：
- 限制单次请求和响应的 max_tokens。
- 用更便宜的模型处理简单任务。
- 缓存常见 query 的回答。
- 优化 prompt，减少不必要的上下文。
- 对用户/功能设置 quota。
- 监控每个请求的成本，异常时告警。

**追问**：
- 限制 max_tokens 会不会影响回答质量？（会；对复杂任务要留足够空间；简单任务可严格限制。）
- 缓存命中率一般多少？（取决于场景；FAQ 类可达 50%+，开放对话类较低。）

### Q4：首 token 延迟（TTFT）和总延迟怎么优化？

**答**：
- **TTFT**：用 streaming、优化 prompt 长度、选更快的模型、预热连接池。
- **总延迟**：用 streaming 让用户先看到部分内容；限制输出长度；用更快的模型或量化模型。
- **吞吐**：batching、动态扩缩容。

**追问**：
- streaming 能不能降低总延迟？（不能降低后端生成时间，但能让用户更快看到首字，感知延迟降低。）
- TTFT 重要还是总延迟重要？（对话场景 TTFT 更重要；批处理场景总延迟更重要。）

### Q5：Rate limit 怎么做？

**答**：
- Token bucket 或 leaky bucket 算法。
- 限流维度：global / tenant / user / model。
- 超过 limit 时：排队、拒绝、降级。
- 对不同用户差异化：付费用户更高 limit。

**追问**：
- 如果用户 burst 请求怎么办？（token bucket 允许一定 burst；leaky bucket 更平滑。）
- 模型服务商的 rate limit 和应用的 rate limit 怎么协调？（应用 limit 要低于服务商 limit，留 buffer。）

### Q6：语义缓存怎么做？

**答**：
- 对 query 做 embedding。
- 在向量库中检索相似历史 query。
- 相似度超过阈值且答案仍有效时，直接返回缓存答案。
- 对精确重复 query 可用 key-value 缓存。

**追问**：
- 缓存答案过期怎么办？（设置 TTL；对时效性问题禁用缓存。）
- 相似 query 但用户不同能复用吗？（若答案不含个性化信息可以；否则要按 user 隔离缓存。）

### Q7：多模型服务如何监控？

**答**：
- 每个模型记录：请求数、latency、token 数、成本、错误率。
- 按 task / tenant / user 维度聚合。
- 设置告警：错误率突增、latency P99 恶化、成本超预算。
- Dashboard 展示 router 决策分布和 fallback 次数。

**追问**：
- 怎么发现某个模型质量下降？（对比 eval metrics、用户反馈、fallback 率。）
- shadow traffic 怎么用？（新模型只接收流量但不返回，用于评估质量和延迟。）

### Q8：模型版本升级怎么做？

**答**：
- 灰度发布：先 1% 流量，再逐步扩大。
- A/B test：对比新旧版本的 metrics。
- 支持快速回滚。
- 保留旧版本一段时间，直到验证稳定。

**追问**：
- 灰度过程中发现新版本更差怎么办？（自动回滚或流量切回旧版本。）
- 模型版本变更影响 prompt 吗？（可能；prompt 也要版本化。）

### Q9：如何处理模型输出不稳定？

**答**：
- 设置 temperature / top_p 控制随机性。
- 对关键任务用 low temperature 或 greedy decoding。
- 多次采样取最好结果（best-of-n）。
- 用 eval 监控输出稳定性。

**追问**：
- best-of-n 成本怎么控制？（n 不能太大；可用小模型做 selector。）
- 输出不稳定一定是坏事吗？（创意类任务需要一定随机性；事实类任务需要稳定。）

### Q10：模型服务如何实现多租户隔离？

**答**：
- 配额按 tenant 隔离。
- 优先级队列：防止一个 tenant 占满资源。
- 成本按 tenant 分摊。
- 数据隔离：不同 tenant 的 prompt/completion 不共享。

**追问**：
- 一个 tenant 突发流量影响其他 tenant 怎么办？（限流 + 资源预留 + 熔断。）
- 共享模型实例会不会泄露数据？（不会，因为模型是无状态的；但要确保日志和缓存隔离。）

## 开放设计题

1. **设计一个多模型网关**：支持 OpenAI、Anthropic、本地模型，支持路由、fallback、quota、缓存、监控。说明路由策略和降级链。

2. **设计一个成本敏感的代码助手路由系统**：简单补全用小模型，复杂重构用大模型。说明如何定义「简单」和「复杂」，以及 cascade 流程。

3. **设计一个实时对话模型的低延迟架构**：目标 TTFT < 200ms。说明 streaming、连接池、缓存、预加载、模型选择策略。

## 与其他模块的关系

- **Agent Runtime / Tool Calling / RAG**：这些模块都需要调用模型，Model Serving 是它们的统一入口。
- **Observability**：Model Serving 的 latency、cost、error 需要被 trace 和监控。
- **Eval**：模型路由和 fallback 的效果要通过 Eval 验证。
- **Safety**：Model Serving 可以拦截敏感请求，做初步 safety check。
- **Streaming UI**：Model Serving 的 streaming 输出直接驱动 Streaming UI。
