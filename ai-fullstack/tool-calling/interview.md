# Tool Calling 面试深度问答

## 核心概念地图

1. **Tool Schema**：描述工具的能力、参数、返回值，让模型知道能调用什么。
2. **Parameter Binding**：把模型输出的 JSON 参数映射到工具函数的实际参数。
3. **Validation & Repair**：校验参数合法性，必要时让模型修正。
4. **Idempotency**：保证同一 tool call 多次执行不会产生重复副作用。
5. **Error Taxonomy**：区分 retryable、fatal、needs_user 错误，决定谁来处理。
6. **Sandbox & Permission**：限制工具执行范围，防止越权。

## 架构与数据流

```text
Model Output (function call JSON)
  → Parser（提取 tool_name / arguments）
  → Registry Lookup（找到 tool 定义）
  → Validator（schema 校验）
  → Permission Check（用户/工具权限）
  → Idempotency Check（是否已执行）
  → Executor（实际执行）
  → Result Normalizer（统一输出格式）
  → Context Injection（结果回传给模型）
```

## 关键设计决策

### 1. Schema 用什么格式？

主流选择：
- **JSON Schema**：通用、模型支持好、可校验。
- **OpenAPI / gRPC**：已有服务可以直接暴露为工具。
- **Function Signature**：代码级工具注册，自动生成 schema。

**Trade-off**：JSON Schema 最灵活但手写麻烦；代码签名生成 schema 最方便但表达能力受语言限制。

### 2. 模型参数解析错了怎么办？

- **Strict mode**：模型必须按 schema 输出，否则重试。
- **Repair loop**：把 validation error 返回给模型，让它修正参数。
- **Default value**：对可选参数提供默认值。
- **Coercion**：对类型兼容的值做隐式转换（如字符串 "123" → 数字 123）。

### 3. 有副作用的工具如何保证幂等？

- 每个 tool call 生成唯一 `tool_call_id` + `idempotency_key`。
- 执行前查状态表：若已执行且成功，直接返回缓存结果；若失败，可重试。
- 工具本身和下游服务都支持幂等（如支付网关的 idempotency key）。

### 4. 工具错误怎么分类？

| 错误类型 | 例子 | 处理方式 |
| --- | --- | --- |
| retryable | 网络超时、503 | 系统自动重试 |
| fatal | 参数非法、权限不足 | 返回错误，Agent 决定下一步 |
| needs_user | 需要用户确认、缺少信息 | 暂停，询问用户 |
| ambiguous | 模型意图不明 | 让模型澄清 |

## 失败路径与恢复

| 失败 | 原因 | 恢复 |
| --- | --- | --- |
| Schema 不匹配 | 模型输出缺少必填参数 | validator 拦截，返回错误让模型修复 |
| 工具不存在 | 模型 hallucination 工具名 | 返回可用工具列表，要求重选 |
| 参数类型错误 | 数字传成字符串 | coercion 修复或返回错误 |
| 工具超时 | 下游慢 | 重试 + fallback；最终标记失败 |
| 重复执行 | 网络重试或 UI 重连 | idempotency key 去重 |
| 权限不足 | 用户无权调用 | 返回 needs_user 或拒绝 |
| 下游返回脏数据 | 结果格式不符合预期 | normalizer 包装为结构化错误 |
| 工具产生副作用后崩溃 | commit 后进程挂掉 | 状态查询接口 + 幂等保证 |

## 面试题与应答脚本

### Q1：Tool Schema 怎么设计才能让模型稳定调用？

**答**：
- 工具名要语义化，比如 `search_orders` 而不是 `tool_1`。
- 参数描述要具体，包含格式、取值范围、示例。
- 必填和可选要明确区分。
- 返回结果也要描述清楚，帮助模型理解下一步。
- 避免一个工具做太多事；工具粒度要适中。

**追问**：
- 参数太多怎么办？（拆成多个小工具，或用嵌套对象但限制深度。）
- 模型总是传错某个参数怎么解决？（加强 description、加 enum、在 validator 中修复并返回提示。）

### Q2：Tool Calling 和 Function Calling 有什么区别？

**答**：Function Calling 是模型层面的一种能力，让模型输出函数调用 JSON。Tool Calling 是应用层的完整运行时，包括 schema 注册、参数校验、执行、错误处理、幂等、结果回传。Function Calling 是 Tool Calling 的一个环节。

**追问**：
- OpenAI 的 functions 和 tools 参数有什么区别？（tools 支持并行调用，且把 function call 作为 message 的一部分。）
- 自研模型没有 function calling 能力怎么办？（用 prompt engineering 让模型输出固定格式 JSON，再自己解析。）

### Q3：工具执行失败后，系统重试和让模型重试有什么区别？

**答**：
- **系统重试**：针对 retryable 错误（网络抖动、服务短暂不可用），不消耗模型 token，速度快。
- **模型重试**：针对参数错误、业务逻辑错误，需要模型理解错误信息并修正参数，消耗 token。

**追问**：
- 怎么判断错误是否 retryable？（错误码、异常类型、业务语义。HTTP 5xx / timeout 通常 retryable；4xx 通常 fatal。）
- 重试次数和退避策略怎么设？（指数退避，max 3 次；对支付等关键操作要谨慎。）

### Q4：如何实现 tool call 的幂等性？

**答**：
1. 每次 tool call 生成唯一 idempotency key，可由调用方传入或系统生成。
2. 执行前查询执行记录：
   - 若已执行成功，直接返回缓存结果。
   - 若已执行失败，根据策略决定是否重试。
   - 若正在执行，可等待或返回冲突。
3. 工具层和下游服务都尽量支持幂等。

**追问**：
- idempotency key 有效期多久？（视业务而定；支付通常 24 小时；查询类可永久。）
- 如果下游服务不支持幂等怎么办？（在工具层先做状态查询，确认未执行才敢重试；或把操作转为「创建-查询-确认」模式。）

### Q5：Tool Result 如何进入上下文？

**答**：
- 把 tool result 包装成 `tool` 角色的 message，格式如：
  ```json
  { "role": "tool", "tool_call_id": "call_123", "content": "{\"balance\": 1000}" }
  ```
- 对复杂结果做 summarization，避免上下文过长。
- 对错误结果也要包装，让模型知道失败原因。

**追问**：
- 工具返回大量数据怎么办？（只保留关键字段；或让模型在 tool call 中指定需要哪些字段。）
- 多个 tool call 并行执行时结果怎么排序？（按 tool_call_id 对应回各自调用。）

### Q6：怎么处理模型调用不存在工具的情况？

**答**：
- Registry lookup 失败时返回错误。
- 把可用工具列表重新发给模型，让它重选。
- 若多次失败，可 fallback 到直接回答或结束 session。

**追问**：
- 模型为什么会 hallucinate 工具名？（上下文干扰、schema 描述不清、模型能力弱。）
- 能不能提前过滤？（可以，在 prompt 里明确可用工具列表，并用 few-shot 示例。）

### Q7：有副作用的工具如何设计权限？

**答**：
- 每个 tool 标注 risk level（read / write / high-risk）。
- 写操作校验用户是否有权限访问对应资源。
- high-risk 操作走 human confirmation gate。
- 所有调用记录 audit log。

**追问**：
- 权限校验放在哪一层？（在 executor 之前做 policy check；registry 只负责找工具。）
- 动态权限怎么支持？（资源级权限，比如「只能操作自己的订单」，需要在执行时根据 user_id 和 resource_id 判断。）

### Q8：Tool Executor 的沙箱怎么设计？

**答**：
- 对本地代码执行类工具，使用容器或 WASM 沙箱。
- 对网络调用类工具，限制允许访问的域名和方法。
- 对文件系统类工具，限制访问路径。
- 设置超时和资源限制（CPU、内存）。

**追问**：
- 沙箱性能和安全性怎么平衡？（轻量操作用 seccomp；复杂代码用容器；不可信代码用 WASM。）
- 如果工具需要访问敏感数据库怎么办？（用只读账号、行级权限、查询白名单。）

### Q9：如何评估 tool calling 的好坏？

**答**：
- **Tool selection accuracy**：是否选对工具。
- **Argument accuracy**：参数是否正确。
- **Success rate**：工具执行成功率。
- **Recovery rate**：失败后能否成功重试。
- **Latency**：从模型输出到工具执行完成的耗时。

**追问**：
- 这些指标怎么自动化？（构造 golden set，包含用户输入、期望 tool、期望参数、期望结果。）
- argument accuracy 怎么定义？（精确匹配；或对数值允许误差，对字符串允许语义等价。）

### Q10：Tool Calling 如何处理并行调用？

**答**：
- 模型一次性输出多个 tool call（如 OpenAI tools 模式支持 parallel calls）。
- Executor 解析出所有调用，判断依赖关系。
- 无依赖的调用并行执行；有依赖的按顺序执行。
- 结果按 tool_call_id 回传。

**追问**：
- 并行调用产生冲突怎么办？（对同一资源的写操作要串行化，或加锁。）
- 部分成功部分失败怎么办？（返回每个调用的独立结果，Agent 决定整体策略。）

## 开放设计题

1. **设计一个统一的 Tool Calling 平台**：支持 REST API、本地函数、数据库查询、文件操作四类工具。说明 registry、schema、权限、幂等、错误处理如何设计。

2. **设计一个代码执行工具的安全沙箱**：用户可以让 Agent 执行任意 Python 代码。如何保证不泄露数据、不破坏系统、不无限运行？

3. **设计一个支付工具的幂等机制**：Agent 调用支付网关扣款，网络超时后如何确保不会重复扣款？画出时序图。

## 与其他模块的关系

- **Agent Runtime**：Tool Calling 是 Agent 的执行手臂；Agent 决定调用什么，Tool Calling 负责安全执行。
- **Safety**：Safety 决定哪些工具能执行、哪些需要确认。
- **Observability**：每个 tool call 都是 trace span，需要记录参数、结果、延迟。
- **Eval**：Tool selection 和 argument accuracy 是 Eval 的核心指标。
- **Streaming UI**：Tool call 状态（pending / running / completed）需要实时展示给用户。
- **Model Serving**：Tool Calling 依赖模型输出 function call JSON；模型能力影响稳定性。
