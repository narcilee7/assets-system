# LLM Gateway Architecture

## LLM Gateway vs 传统 API Gateway

| 维度 | 传统 API Gateway（Kong/Nginx） | LLM Gateway（Portkey/AI Gateway） |
|------|------------------------------|--------------------------------|
| **协议** | HTTP REST / gRPC | HTTP SSE / WebSocket / 自定义流协议 |
| **延迟特征** | 毫秒级，稳定 | 秒级~分钟级，极不稳定（首 token 延迟 + 生成延迟） |
| **负载指标** | QPS、并发连接 | **并发请求数 + Token 吞吐（TPM）** |
| **响应模式** | 一次性返回 | **流式（SSE）为主**，需要逐 token 转发 |
| **错误类型** | 4xx/5xx | 429（限流）、503（模型过载）、context limit（上下文超限） |
| **成本模型** | 按请求/带宽 | **按 Token 计费**，需要精确计量 |
| **缓存策略** | HTTP Cache | **语义缓存**（相同/相似问题复用结果） |

**一句话**：LLM Gateway 不是"转发 HTTP"，而是**管理不稳定、高延迟、高成本的生成式推理流量**。

---

## 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                        │
│           
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      LLM Gateway                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │  Router  │ │  Load    │ │ Circuit │ │ Stream  │        │
│  │ (路由)   │ │Balancer │ │ Breaker │ │ Aggregator│        │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │
│       └─────────────┴─────────────┴─────────────┘          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │  Retry  │ │  Cache  │ │  Quota  │ │Metrics  │        │
│  │ (重试)   │ │ (缓存)   │ │ (配额)   │ │(计量)   │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
└──────────────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
  ┌─────────┐    ┌─────────┐    ┌─────────┐
  │ OpenAI  │    │ Claude  │    │ DeepSeek│
  │  API    │    │  API    │    │  API    │
  └─────────┘    └─────────┘    └─────────┘
       │               │               │
  ┌─────────┐    ┌─────────┐    ┌─────────┐
  │Azure OAI│    │Bedrock  │    │ 本地模型 │
  │(Fallback)│    │(Backup) │    │(私有部署)│
  └─────────┘    └─────────┘    └─────────┘
```

---

## 逐模块深挖

### 1. Router（路由策略）

"支持多种路由策略"。**具体有哪些？**

| 策略 | 原理 | 适用场景 |
|------|------|---------|
| **Round Robin** | 轮询，依次分发 | 模型能力同质、成本相同 |
| **Weighted** | 按权重分配（OpenAI 70%，Claude 30%） | 成本优化、A/B 测试 |
| **Latency-based** | 实时监测延迟，路由到最快节点 | 延迟敏感（实时对话） |
| **Cost-based** | 按 Token 成本路由 | 成本敏感（批量任务） |
| **Capability-based** | 按模型能力路由（推理任务 → R1，简单任务 → GPT-4o-mini） | **Phus 场景** |
| **Fallback** | 主模型失败，自动降级到备用 | 高可用 |
| **Canary** | 新模型小流量灰度 | 模型上线验证 |

**Phus 映射**：你的 Provider Mesh 怎么路由？

**建议话术**：
> "Phus 的 Provider Mesh 采用**能力路由 + 成本路由**的混合策略。规划类任务（△M 生成、Verifier）路由到 DeepSeek-R1 / o1，因为需要强推理；执行类任务（工具调用、格式化输出）路由到 GPT-4o-mini / Qwen-72B，因为快、便宜、格式遵循好；兜底场景（主模型 429/503）自动 Fallback 到 Azure OpenAI 或本地模型。路由决策在请求级别动态计算，支持按用户/任务类型覆盖。"

**面试点**：路由决策的延迟怎么控制？

**答**：
- **预计算**：模型健康状态、延迟百分位每 10s 更新一次，路由时查缓存，不实时探测。
- **本地决策**：路由逻辑在 Gateway 进程内完成，不依赖外部服务。
- **默认策略**：如果健康数据过期，回退到静态权重，不阻塞请求。

---

### 2. Load Balancer（负载均衡）

LLM 的负载均衡和传统不同——**不是按请求数，而是按 Token 数和并发槽位**。

#### 关键指标

| 指标 | 含义 | 为什么重要 |
|------|------|-----------|
| **RPM（Requests Per Minute）** | 每分钟请求数 | 供应商限流维度之一 |
| **TPM（Tokens Per Minute）** | 每分钟 Token 数 | 供应商核心限流维度 |
| **Concurrent Requests** | 并发请求数 | 模型推理是计算密集型，并发高了排队 |
| **TTFT（Time To First Token）** | 首 token 延迟 | 用户体验核心指标 |
| **TPOT（Time Per Output Token）** | 每输出 token 耗时 | 生成速度指标 |

**负载算法**：

```python
# 基于 Token 槽位的负载均衡
class TokenBucketLoadBalancer:
    def select(self, providers: List[Provider], request: Request) -> Provider:
        # 估算请求 Token 数（input + expected_output）
        estimated_tokens = estimate_tokens(request)
        
        # 找有足够"槽位"的 Provider
        candidates = [
            p for p in providers 
            if p.available_tpm >= estimated_tokens 
            and p.available_rpm >= 1
            and p.active_connections < p.max_connections
        ]
        
        # 在候选者中选 TTFT 最低的
        return min(candidates, key=lambda p: p.ttft_p99)
```

**面试点**：怎么估算请求的 Token 数？

**答**：
- **精确计算**：用 tiktoken / tokenizer 计算 input tokens。
- **output 预估**：根据历史数据，该类型任务的平均 output tokens（比如代码生成平均 800 tokens）。
- **动态调整**：实际生成过程中，如果超过预估，触发流控或降级。

---

### 3. Circuit Breaker（熔断器）

你的简历直接写了"Circuit Breaker"。**LLM 场景的熔断有什么特殊？**

#### 熔断状态机

```
CLOSED ──(错误率 > 阈值)──► OPEN ──(超时后)──► HALF_OPEN ──(探测成功)──► CLOSED
   ▲                                                        │
   └────────────────(探测失败)───────────────────────────────┘
```

#### LLM 特殊错误码

| 错误 | 含义 | 熔断策略 |
|------|------|---------|
| **429** | 速率限制 | 不熔断，只是排队或换 Provider |
| **503** | 服务不可用 | 快速熔断，切换 Provider |
| **500** | 内部错误 | 熔断，但半开后重试 |
| **context_length_exceeded** | 上下文超限 | 不熔断，属于请求问题，返回客户端调整 |
| **timeout** | 网关/模型超时 | 按超时比例熔断 |

**Phus 的熔断设计建议**：

```python
class LLMCircuitBreaker:
    def should_trip(self, metrics: WindowMetrics) -> bool:
        # 传统熔断：错误率 > 50% 且请求数 > 10
        if metrics.error_rate > 0.5 and metrics.request_count > 10:
            return True
        
        # LLM 特殊：TTFT P99 > 10s（模型过载）
        if metrics.ttft_p99 > 10_000:  # ms
            return True
            
        # LLM 特殊：TPM 持续打满（供应商限流）
        if metrics.tpm_utilization > 0.95 for 2_minutes:
            return True
            
        return False
```

**面试点**：429 为什么不熔断？

**答**：429 是**预期内的限流**，不是服务故障。熔断器的作用是防止把请求打到已经故障的节点上。429 说明服务还活着，只是忙。正确的做法是**退避重试**（指数退避）或**负载转移**（换 Provider），而不是熔断。

---

### 4. Retry & Fallback（重试与故障转移）

#### 重试策略

| 场景 | 策略 | 原因 |
|------|------|------|
| **429 限流** | 指数退避（1s → 2s → 4s → 8s），最多 3 次 | 给供应商恢复时间 |
| **503 过载** | 立即换 Provider，不重试原节点 | 原节点已经过载，重试加剧 |
| **网络超时** | 换 Provider + 1 次重试 | 可能是网络抖动 |
| **500 内部错误** | 换 Provider，原节点进入半开探测 | 服务端 bug，可能快速恢复 |

#### Fallback 链

```python
fallback_chain = [
    "deepseek-r1",      # 主模型
    "azure-gpt-4o",     # 备用 1（同能力，不同供应商）
    "claude-3.5-sonnet",# 备用 2（不同模型，能力接近）
    "local-qwen-72b"    # 兜底（本地部署，能力降级但可用）
]
```

**面试点**：Fallback 到能力更低的模型，怎么保证输出质量不崩？

**答**：
- **Prompt 自适应**：检测到 Fallback 后，自动简化 Prompt（去掉复杂 Few-shot，用更明确的指令）。
- **输出校验**：低能力模型的输出经过更严格的 Verifier 检查。
- **用户感知**：高价值任务 Fallback 时通知用户"正在使用备用模型，可能稍慢"。
- **能力降级协议**：定义每个任务的最低可接受模型（比如代码生成最低 GPT-4o-mini，不能降到 7B）。

---

### 5. Stream Aggregator（流式聚合）

这是**LLM Gateway 最复杂的模块**，也是和传统 Gateway 最大的区别。

#### 为什么需要流式聚合？

- **多 Provider 并发**：同一个请求同时发给 3 个模型，取最快的结果。
- **流式返回**：用户要的是 SSE 逐 token 返回，Gateway 需要管理多个上游流。
- **取消传播**：用户中途断开，所有上游流都要取消。

#### 并发请求模式

| 模式 | 原理 | 适用 |
|------|------|------|
| ** fastest-first** | 同时发多个 Provider，哪个先返回首 token，就采用哪个的流，取消其他 | 延迟敏感（实时对话） |
| **self-consistency** | 同时发 3 个，全部收完后投票选最优 | 质量敏感（数学/代码） |
| **streaming merge** | 多个流逐 token 聚合（比如一个模型生成中文，一个生成英文，合并）| 极少用，复杂度高 |

**fastest-first 的实现难点**：

```python
async def fastest_first(request, providers):
    # 同时启动所有 Provider 的流式请求
    streams = [await provider.stream(request) for p in providers]
    
    #  raced：哪个先返回首 token
    done, pending = await asyncio.wait(
        [wait_first_token(s) for s in streams],
        return_when=asyncio.FIRST_COMPLETED
    )
    
    winner = done.pop().result()
    
    # 取消其他流（重要！否则浪费 Token）
    for task in pending:
        task.cancel()
        # 发送取消信号给上游 Provider（如果支持）
        await task.exception()  # 确保上游连接关闭
    
    # 转发 winner 的流给用户
    async for token in winner:
        yield token
```

**面试点**：取消其他流时，已经产生的 Token 费用谁承担？

**答**：
- **供应商策略**：OpenAI 按实际输出 Token 计费，取消后已生成的 Token 仍然计费。
- **成本控制**：fastest-first 的"预热"成本需要纳入预算，或者和供应商协商"取消不计费"（通常不可能）。
- **工程权衡**： fastest-first 适合高价值低延迟场景，批量任务不用这个模式。

---

### 6. Cache（语义缓存）

传统 HTTP Cache 对 LLM 无效——"北京天气"和"今天北京天气怎么样"语义相同，但文本不同。

#### 语义缓存架构

```
用户查询 → Embedding → 向量检索缓存库 → 
  相似度 > 阈值（如 0.95）→ 直接返回缓存结果
  相似度 < 阈值 → 走正常请求 → 结果写入缓存
```

**缓存键设计**：
- **精确匹配**：相同 Prompt → 相同结果（适合代码生成、固定模板）
- **语义匹配**：Embedding 相似 → 可能复用（适合问答、分析）
- **参数化匹配**：相同模板，不同参数（比如"查 {city} 天气"，缓存模板，参数替换）

**面试点**：缓存命中率怎么提升？

**答**：
- **Query 规范化**：去掉口语化差异（"咋退款" → "如何退款"），统一后再检索缓存。
- **分层缓存**：L1 精确匹配（Redis），L2 语义匹配（向量库），L3 模板匹配（规则）。
- **TTL 策略**：代码生成缓存 1 小时（变化快），知识问答缓存 1 天（变化慢）。

---

### 7. Quota & Metering（配额与计量）

#### 多租户配额

```python
class QuotaManager:
    def check(self, tenant_id: str, request: Request) -> bool:
        tenant = self.get_tenant(tenant_id)
        
        # 检查 RPM
        if tenant.rpm_used >= tenant.rpm_limit:
            raise QuotaExceeded("RPM limit reached")
        
        # 检查 TPM
        estimated = estimate_tokens(request)
        if tenant.tpm_used + estimated > tenant.tpm_limit:
            raise QuotaExceeded("TPM limit would be exceeded")
        
        # 检查成本预算
        estimated_cost = estimate_cost(request, target_model)
        if tenant.cost_used + estimated_cost > tenant.budget:
            raise QuotaExceeded("Budget exceeded")
        
        return True
```

**面试点**：Token 计量怎么保证准确？

**答**：
- **客户端估算**：用 tiktoken 预计算 input tokens。
- **服务端确认**：实际调用后，供应商返回 usage（prompt_tokens + completion_tokens），以此为准。
- **对账机制**：每日和供应商账单对账，差异 > 5% 触发告警。

---

### 8. 可观测性

| 维度 | 指标 | 实现 |
|------|------|------|
| **延迟** | TTFT、TPOT、端到端延迟 | OpenTelemetry Span |
| **成本** | 每请求 Token 数、费用 | 埋点 + 供应商账单 |
| **质量** | 路由准确率、Fallback 率、缓存命中率 | 业务埋点 |
| **健康** | 各 Provider 错误率、TTFT P99 | Prometheus + Grafana |
| **追踪** | 请求全链路（Gateway → Provider → 返回） | OpenTelemetry Trace |

**面试点**：Gateway 本身挂了怎么办？

**答**：
- **无状态设计**：Gateway 不保存会话状态，崩溃后新实例立即接管（K8s HPA）。
- **客户端降级**：SDK 内置本地模型或缓存，Gateway 不可用时直接走本地。
- **多实例负载均衡**：Gateway 前挂 Nginx/Envoy，单实例故障自动剔除。
- 
---

## 面试刁难题

### 刁难 1：同一个请求，Gateway 路由到 Provider A，A 生成了一半后 503 了，怎么把上下文迁移到 Provider B 继续生成？

**答**：
- **有状态迁移（难）**：如果 A 和 B 是同一模型（比如都是 GPT-4o），且支持上下文恢复，可以把已生成的 tokens 作为 prefix 发给 B 继续。但不同模型（GPT → Claude）的 tokenizer 不同，无法直接迁移。
- **无状态回退（实际做法）**：503 后返回错误给客户端，客户端选择重试（重新发完整请求）或降级（接受不完整结果）。
- **流式检查点**：Gateway 每 N 个 token 缓存一次生成状态，故障时从检查点恢复。但这需要模型支持，且增加复杂度。

### 刁难 2：你的 Gateway 怎么防止"用户 A 的配额被用户 B 刷光"？

**答**：
- **身份认证**：每个请求带 JWT/API Key，Gateway 解析出 tenant_id。
- **配额隔离**：tenant_id 作为 Redis key 前缀，RPM/TPM 按租户独立计数。
- **速率限制**：单用户级别限流（比如每秒 1 请求），防止单用户刷爆。
- **成本上限**：每日预算硬上限，超过后拒绝请求（或降级到免费模型）。

### 刁难 3：Gateway 转发流式响应时，如果上游 Provider 的 token 生成速度不均匀（时快时慢），怎么保证下游用户的体验？

**答**：
- **缓冲平滑**：Gateway 维护一个小缓冲（比如 50ms 的 token 队列），上游快时存起来，慢时释放，平滑输出节奏。
- **心跳保持**：如果上游超过 500ms 没返回 token，Gateway 向下游发送 SSE comment（`:keep-alive`），防止客户端超时断开。
- **超时兜底**：如果上游卡住超过 30s，返回错误给客户端，不无限等待。

### 刁难 4：你的 Gateway 支持本地模型（比如 vLLM 部署的 Qwen），和云 API 的接口差异怎么屏蔽？

**答**：
- **OpenAI 兼容层**：vLLM / TGI 都支持 OpenAI API 格式，本地模型走兼容层。
- **Adapter 模式**：如果本地模型是自定义格式（比如自研推理服务），写 Adapter 转换为内部标准格式。
- **统一接口**：Gateway 上层只看到标准 `chat.completions` 接口，不感知底层是 OpenAI、Claude 还是本地 vLLM。

---

## 快速自检清单

| 问题 | 你应该能答出 |
|------|-------------|
| LLM Gateway 和传统 Gateway 的核心区别？ | 流式、Token 计费、高延迟、语义缓存 |
| 路由策略有哪些？ | Round Robin、Weighted、Latency、Cost、Capability、Fallback、Canary |
| 负载均衡按什么指标？ | Token 槽位、并发数、TTFT，不是按请求数 |
| 429 为什么不熔断？ | 是限流不是故障，应该退避或换 Provider |
| fastest-first 怎么取消其他流？ | asyncio.wait + task.cancel，确保上游连接关闭 |
| 语义缓存怎么实现？ | Embedding + 向量检索 + 相似度阈值 |
| 多租户配额怎么隔离？ | tenant_id + Redis 独立计数 + 硬预算上限 |

---
