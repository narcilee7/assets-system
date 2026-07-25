# Safety 面试深度问答

## 核心概念地图

1. **Policy**：定义谁（user）能在什么上下文下对什么资源（resource）执行什么动作（action）。
2. **Confirmation Gate**：高风险操作执行前需要用户明确确认。
3. **Sandbox**：限制工具执行环境，防止越权和破坏。
4. **Data Boundary**：租户隔离、PII 保护、敏感数据不泄露。
5. **Audit Log**：记录谁做了什么、为什么、结果如何。
6. **Prompt Injection**：攻击者通过输入让模型违背原本指令。

## 架构与数据流

```text
User Input / Tool Call Request
  → Policy Engine
    → Intent Analysis（是否是恶意输入）
    → Permission Check（是否有权）
    → Risk Assessment（风险等级）
      → Low: 直接执行
      → Medium: 额外日志
      → High: Confirmation Gate
      → Critical: 拒绝
  → Sandbox Execution（如果需要）
  → Audit Log
```

## 关键设计决策

### 1. Policy 模型怎么设计？

常用 ABAC（Attribute-Based Access Control）：

```text
allow(user, action, resource, context) if
  user.role == "admin" or
  (user.tenant == resource.tenant and action in user.allowed_actions)
```

也可以结合 RBAC：
- 角色定义默认权限。
- ABAC 处理细粒度条件（如只能操作自己的订单）。

### 2. 哪些操作需要 Confirmation Gate？

- 资金操作：支付、退款、转账。
- 数据删除：删除账户、删除订单历史。
- 外部通信：发送邮件/短信/消息给第三方。
- 敏感信息访问：查看他人数据、导出 PII。
- 高风险工具：执行代码、修改配置。

### 3. Sandbox 怎么选？

| 级别 | 方案 | 适用 |
| --- | --- | --- |
| 进程级 | seccomp、namespace | 本地命令、文件操作 |
| 容器级 | Docker / containerd | 不可信代码执行 |
| WASM | WASM runtime | 轻量、快速启动的沙箱 |
| 网络级 | 代理、白名单 | 限制外部访问 |

### 4. Prompt Injection 怎么防？

- **输入侧**：
  - 过滤敏感指令（如 "ignore previous instructions"）。
  - 使用 prompt 分隔符明确区分用户输入和系统指令。
- **模型侧**：
  - 训练或 prompt 让模型优先遵循系统指令。
  - 使用专门检测模型识别 injection。
- **输出侧**：
  - 对模型生成的 tool call 做 policy check。
  - 不允许用户输入直接作为 tool 名或参数名。

## 失败路径与恢复

| 失败 | 原因 | 恢复 |
| --- | --- | --- |
| Policy 判断错误 | 规则过严/过松 | 灰度观察、人工复核、持续调优 |
| Confirmation 被绕过 | UI 自动化或 API 重放 | 确认需带一次性 token、签名、时间戳 |
| Sandbox 逃逸 | 漏洞或配置错误 | 最小权限、多层防御、定期审计 |
| 数据泄露 | 跨租户查询未过滤 | 强制 tenant_id 过滤、数据脱敏 |
| Prompt injection 成功 | 防御层失效 | 多层防御、输出侧 policy check、人工 escalation |
| Audit log 被篡改 | 存储不安全 | 只追加、加密、独立存储 |
| 用户拒绝 confirmation | 高风险操作被取消 | Agent 优雅降级，告知用户无法完成 |

## 面试题与应答脚本

### Q1：AI 应用的安全和传统应用有什么不同？

**答**：
- 传统应用安全边界清晰：用户能访问什么资源由后端控制。
- AI 应用中，模型可能根据用户输入自主决定调用工具，增加了不可预测性。
- 需要额外防御 prompt injection、模型幻觉导致的越权、工具滥用。
- 安全决策不能只在输入侧做，输出侧（tool call）也要校验。

**追问**：
- 模型本身能不能做安全判断？（可以辅助，但不能完全依赖；最终决策应由确定性 policy engine 做。）
- 安全校验放在模型前还是模型后？（都要：输入侧防 injection，输出侧防越权 tool call。）

### Q2：Prompt Injection 和 Jailbreak 有什么区别？

**答**：
- **Prompt Injection**：通过输入覆盖或干扰系统指令，让模型执行攻击者意图（如泄露 prompt、调用未授权工具）。
- **Jailbreak**：让模型输出有害、违法、违背伦理的内容。
- 两者相关但不完全相同；防护措施有重叠。

**追问**：
- 哪个对 Agent 威胁更大？（Prompt Injection 更大，因为它可能触发真实工具执行。）
- 怎么检测 Prompt Injection？（规则过滤、异常检测模型、输出行为监控。）

### Q3：如何防止用户通过输入让 Agent 调用未授权工具？

**答**：
- 工具名和参数结构由系统控制，不能从用户输入中直接解析。
- 模型生成的 tool call 必须经过 policy engine 校验。
- 根据用户身份和资源 ID 判断是否有权限。
- 高风险工具必须 confirmation gate。

**追问**：
- 如果模型被 injection 后生成 tool call，但参数里带恶意内容？（参数也要校验类型、范围、权限；对字符串参数做内容检测。）
- 工具执行结果返回给用户前要不要过滤？（要，防止泄露敏感信息。）

### Q4：Confirmation Gate 怎么防止被绕过？

**答**：
- 确认请求带唯一 token，后端校验 token 和 session 绑定。
- 确认界面明确展示工具名、参数、影响范围。
- 用户对参数的修改需要重新走 policy check。
- 确认超时后 token 失效。
- 记录确认日志，便于审计。

**追问**：
- 如果攻击者截获了确认 token 重放怎么办？（token 一次性有效，且绑定用户/session。）
- 用户点太快没看清怎么办？（二次确认 + 影响范围高亮 + 可撤销窗口期。）

### Q5：Sandbox 和权限控制有什么区别？

**答**：
- **权限控制**：决定用户/Agent 能不能调用某个工具。
- **Sandbox**：即使工具被调用，也限制其执行环境，防止破坏系统。
- 两者互补：权限控制防越权，Sandbox 防执行风险。

**追问**：
- 代码执行工具没有 sandbox 会有什么后果？（可能读取敏感文件、网络攻击、资源耗尽。）
- Sandbox 能完全防住风险吗？（不能；需要多层防御 + 审计。）

### Q6：多租户场景下如何保证数据边界？

**答**：
- 所有数据访问带 tenant_id。
- 检索和工具执行时强制 tenant filter。
- 不同 tenant 的 prompt/completion 不共享上下文。
- 向量库按 tenant namespace 或 metadata 隔离。
- 审计日志也按 tenant 隔离。

**追问**：
- 共享模型会不会跨租户泄露？（不会，模型是无状态的；但要防止 prompt 中混入其他租户数据。）
- 管理员能不能查看所有租户数据？（需要明确授权和审计；默认不能。）

### Q7：Audit Log 要记录什么？

**答**：
- 谁（user / agent / session）。
- 做了什么（tool name / action / parameters hash）。
- 对什么资源（resource id / tenant id）。
- 结果（success / failure / denied）。
- 时间戳。
- 决策依据（policy rule id / confirmation token）。

**追问**：
- 记录原始参数还是 hash？（敏感参数记 hash；非敏感可记原文；需要 debug 时在受控环境查。）
- Audit log  itself 怎么保护？（只追加、加密、独立存储、定期备份。）

### Q8：Safety 和 Eval 有什么关系？

**答**：
- Eval 中必须包含 safety test cases：prompt injection、越权请求、敏感数据访问。
- Safety policy 的误拦截率、漏拦截率需要通过 eval 量化。
- 线上 safety violation 要进入 audit log 并触发告警。

**追问**：
- 误拦截和漏拦截哪个更危险？（漏拦截更危险，因为可能导致真实损失；但误拦截影响用户体验。）
- 怎么平衡？（根据业务风险定阈值；高风险场景宁可误拦。）

### Q9：如何处理模型幻觉导致的安全问题？

**答**：
- 对模型输出做 fact check（RAG citation、tool result 校验）。
- 高风险信息（如医疗、法律）加免责声明或要求人工确认。
- 限制模型在不确定时乱答（拒答策略）。
- 对模型输出做 safety filter。

**追问**：
- 模型给出错误建议但没有调用工具，怎么处理？（加 disclaimer；对专业领域引导用户咨询专家。）
- 怎么评估幻觉？（eval 中设 correctness / faithfulness 指标。）

### Q10：AI Safety 的治理流程怎么建？

**答**：
- 制定 safety policy，明确风险等级和处置方式。
- 在产品设计阶段做 threat modeling。
- 开发阶段实现 policy engine、confirmation gate、sandbox、audit。
- 测试阶段跑 safety eval。
- 上线后监控 violation、定期复盘。
- 建立 incident response 流程。

**追问**：
- Safety policy 谁来定？（安全、产品、法务、工程共同制定。）
- 上线后发现新风险怎么办？（快速更新 policy、回滚、通知受影响用户。）

## 开放设计题

1. **设计一个 AI 客服的 Safety 系统**：用户可能要求退款、修改他人地址、索要他人订单信息。说明 policy engine、confirmation gate、audit log 如何设计。

2. **设计一个代码执行 Agent 的安全沙箱**：用户让 Agent 执行任意 Python 代码来分析数据。说明如何隔离文件系统、网络、CPU/内存，以及如何审计。

3. **设计一个多租户 RAG 系统的数据边界**：不同租户上传自己的文档，问自己的知识库。说明租户隔离、PII 处理、跨租户检索防护。

## 与其他模块的关系

- **Agent Runtime / Tool Calling**：Safety 是 Agent 调用工具前的守门员。
- **Memory**：Memory 中的 PII 需要 Safety 保护和审计。
- **RAG**：RAG 检索需要 tenant 隔离和敏感信息过滤。
- **Observability**：Safety violation 需要被记录、监控、告警。
- **Eval**：Safety eval 是核心测试集。
- **Workflow Orchestration**：高风险 workflow step 需要 Safety approval。
