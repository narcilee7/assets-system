# Observability

## 三大支柱

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    日志      │    │    指标      │    │    链路      │
│  (Logs)      │    │  (Metrics)   │    │  (Traces)    │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ 工具调用     │    │ 延迟/吞吐   │    │ 请求路径     │
│ 会话事件     │    │ 工具成功率   │    │ 工具链       │
│ 错误堆栈     │    │ 质量评估    │    │ 上下文构建   │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 1. 日志（Logs）

### 会话事件日志

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "event": "agent.session.created",
  "session_id": "sess-01HV3WWZP",
  "user_id": "u12345",
  "agent_id": "agent-doc-assistant",
  "config": {
    "temperature": 0.7,
    "tools": ["web_search", "code_interpreter"]
  },
  "timestamp": "2024-06-01T10:00:00.000Z"
}
```

### 消息日志

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "event": "agent.message.sent",
  "session_id": "sess-01HV3WWZP",
  "message_id": "msg-01HV3WWZP",
  "role": "user",
  "content": "帮我查找今年 AI 领域的最新进展",
  "content_tokens": 45,
  "timestamp": "2024-06-01T10:00:00.000Z"
}
```

### 工具调用日志

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "event": "agent.tool.call_start",
  "session_id": "sess-01HV3WWZP",
  "message_id": "msg-01HV3WWZP",
  "tool_name": "web_search",
  "arguments": {
    "query": "2024 AI 最新进展",
    "max_results": 10
  },
  "timestamp": "2024-06-01T10:00:05.000Z"
}
```

```json
{
  "event": "agent.tool.call_end",
  "tool_name": "web_search",
  "duration_ms": 1234,
  "status": "success",
  "result_size": 5678,
  "timestamp": "2024-06-01T10:00:06.234Z"
}
```

```json
{
  "event": "agent.tool.call_error",
  "tool_name": "web_search",
  "error_code": "TIMEOUT",
  "error_msg": "request timeout after 5000ms",
  "attempts": 3,
  "timestamp": "2024-06-01T10:00:06.234Z"
}
```

### 流式输出日志

```json
{
  "event": "agent.stream.text_delta",
  "message_id": "msg-01HV3WWZP",
  "content": "根据搜索结果，2024 年 AI 领域的重要进展包括：",
  "token_index": 1,
  "timestamp": "2024-06-01T10:00:06.500Z"
}
```

---

## 2. 指标（Metrics）

### 请求和延迟指标

```prometheus
# 请求量
agent_requests_total{agent_id="agent-doc-assistant"} 123456
agent_requests_rate{agent_id="agent-doc-assistant"} 1423.5

# 首次响应延迟
agent_first_token_latency_seconds{agent_id="agent-doc-assistant", quantile="0.5"} 0.320
agent_first_token_latency_seconds{agent_id="agent-doc-assistant", quantile="0.9"} 0.450
agent_first_token_latency_seconds{agent_id="agent-doc-assistant", quantile="0.99"} 0.520

# Token 间延迟
agent_token_latency_seconds{agent_id="agent-doc-assistant", quantile="0.5"} 0.050
agent_token_latency_seconds{agent_id="agent-doc-assistant", quantile="0.9"} 0.080
agent_token_latency_seconds{agent_id="agent-doc-assistant", quantile="0.99"} 0.120

# 消息长度
agent_message_tokens{agent_id="agent-doc-assistant", quantile="0.5"} 512
agent_message_tokens{agent_id="agent-doc-assistant", quantile="0.9"} 1024
agent_message_tokens{agent_id="agent-doc-assistant", quantile="0.99"} 2048
```

### 工具调用指标

```prometheus
# 工具调用总量
agent_tool_calls_total{tool="web_search", status="success"} 95234
agent_tool_calls_total{tool="web_search", status="failed"} 123

# 工具调用成功率
agent_tool_call_success_rate{tool="web_search"} 0.9987

# 工具调用延迟
agent_tool_call_latency_seconds{tool="web_search", quantile="0.5"} 0.523
agent_tool_call_latency_seconds{tool="web_search", quantile="0.9"} 1.023
agent_tool_call_latency_seconds{tool="web_search", quantile="0.99"} 2.145

# 工具调用重试率
agent_tool_call_retry_rate{tool="web_search"} 0.023

# 工具调用分布
agent_tool_calls_by_type{type="builtin"} 45234
agent_tool_calls_by_type{type="external"} 52345
```

### 会话指标

```prometheus
# 活跃会话
agent_active_sessions 95234
agent_sessions_rate{status="created"} 1234.5
agent_sessions_rate{status="completed"} 1198.3

# 上下文利用率
agent_context_utilization{session="sess-01HV3WWZP"} 0.39
agent_context_tokens{session="sess-01HV3WWZP"} 3200
agent_context_limit{session="sess-01HV3WWZP"} 8192

# 会话平均长度
agent_session_message_count{quantile="0.5"} 24
agent_session_duration_seconds{quantile="0.5"} 1800
```

### 记忆指标

```prometheus
# 记忆检索
agent_memory_search_total{type="semantic"} 123456
agent_memory_search_latency_seconds{quantile="0.99"} 0.045
agent_memory_retrieval_relevance_score{quantile="0.5"} 0.82

# 记忆存储
agent_memory_stored_total{type="preference"} 12345
agent_memory_stored_total{type="fact"} 6789
```

### 评估指标

```prometheus
# 评估质量
agent_eval_quality_score{metric="accuracy", agent_id="agent-doc-assistant"} 0.8523
agent_eval_quality_score{metric="relevance", agent_id="agent-doc-assistant"} 0.9123
agent_eval_quality_score{metric="safety", agent_id="agent-doc-assistant"} 0.9923

# 评估回归
agent_eval_regression_detected 0
agent_eval_regression_delta{metric="accuracy"} -0.0012
```

---

## 3. 链路追踪（Distributed Tracing）

### Agent 请求 Trace

```
Trace: trace-01HV3WWZP

Root Span: agent.message
  │
  ├── Span: context.build
  │     latency: 45ms
  │     └── 从 Redis 加载会话历史
  │
  ├── Span: memory.search
  │     latency: 23ms
  │     └── 检索长期记忆
  │
  ├── Span: planning
  │     latency: 120ms
  │     └── LLM 生成执行计划
  │
  ├── Span: tool.web_search
  │     latency: 1234ms
  │     └── 调用 web_search 工具
  │
  ├── Span: response.generate
  │     latency: 2345ms
  │     └── LLM 生成最终响应
  │
  └── Span: memory.store
        latency: 12ms
        └── 存储重要信息到长期记忆
```

### 工具调用链路

```
Span: tool.web_search
  │
  ├── Span: tool.invoke
  │     latency: 1000ms
  │
  └── Span: tool.result.parse
        latency: 3ms
```

---

## 4. 告警规则

### 核心告警

| 告警名称 | 条件 | 严重程度 | 说明 |
|----------|------|----------|------|
| **HighFirstTokenLatency** | 首 token > 500ms，持续 5min | P2 | 用户等待时间长 |
| **HighTokenLatency** | Token 间延迟 > 100ms，持续 5min | P2 | 输出卡顿 |
| **ToolCallSuccessRateLow** | 工具成功率 < 99.5% | P1 | 工具不稳定 |
| **ToolCallTimeoutHigh** | 工具超时率 > 5% | P2 | 外部 API 问题 |
| **ContextUtilizationHigh** | 上下文利用率 > 90% | P2 | 接近 context 限制 |
| **EvalQualityLow** | 评估分数 < 0.80 | P1 | 输出质量下降 |
| **EvalRegression** | 评估分数下降 > 2% | P1 | 模型更新导致退化 |
| **MemoryRetrievalQualityLow** | 记忆检索相关性 < 0.7 | P2 | 记忆系统问题 |
| **SessionCountHigh** | 并发会话 > 80% 容量 | P2 | 容量预警 |

### 告警配置示例

```yaml
groups:
  - name: agent_alerts
    rules:
      - alert: HighFirstTokenLatency
        expr: |
          histogram_quantile(0.99,
            rate(agent_first_token_latency_seconds_bucket[5m])
          ) > 0.500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Agent 首次响应延迟过高"
          description: "P99 首次响应延迟 {{ $value }}s，超过 500ms 阈值"

      - alert: ToolCallSuccessRateLow
        expr: |
          1 - (rate(agent_tool_calls_total{status="failed"}[5m]) /
              (rate(agent_tool_calls_total{status="success"}[5m]) +
               rate(agent_tool_calls_total{status="failed"}[5m])) < 0.995
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "工具调用成功率过低"
          description: "工具 {{ $labels.tool }} 成功率 {{ $value | humanizePercentage }}，低于 99.5% 阈值"

      - alert: EvalRegression
        expr: |
          delta(agent_eval_quality_score{metric="accuracy"}[24h]) < -0.02
        labels:
          severity: critical
        annotations:
          summary: "Agent 评估质量退化"
          description: "模型评估分数下降 {{ $value | humanizePercentage }}，超过 2% 阈值"
```

---

## 5. 仪表盘（Grafana）

### Agent 概览仪表盘

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Platform Overview          Region: CN-North-1             │
├─────────────────────────────────────────────────────────────────┤
│  Active Sessions   First Token    Token Latency   Tool Success    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │  95,234    │ │   320ms    │ │   50ms     │ │   99.87%   │ │
│  │  +2.3%     │ │  [正常]    │ │  [正常]    │ │  [正常]    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                              │
│  [会话数趋势]        [延迟趋势]        [工具成功率]             │
│  ████████████       ▁▂▃▄▅▆▇██      ▂▃▅▆▇█▇▅▃▂            │
├─────────────────────────────────────────────────────────────────┤
│  Tool Calls by Type               Context Utilization            │
│  ┌────────────────────┐        ┌────────────────────┐        │
│  │ web_search:  45% │        │ Avg:  39%          │        │
│  │ code_interp:  30% │        │ P95:  78%          │        │
│  │ image_gen:   15% │        │ Max:  91% ⚠️      │        │
│  │ db_query:   10%  │        └────────────────────┘        │
│  └────────────────────┘                                     │
├─────────────────────────────────────────────────────────────────┤
│  Eval Quality Scores                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Accuracy:  85.2%  ████████████████████░░░░          │    │
│  │ Relevance: 91.2%  ████████████████████████░░       │    │
│  │ Safety:    99.2%  ██████████████████████████░░    │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 日志聚合与查询

### 日志存储架构

```
Agent 服务节点
  │
  ├── 结构化日志（JSON Lines）
  │    - session_id, message_id, tool_name, latency
  │
  ▼
Fluent Bit / OTel Collector
  │
  ▼
Kafka（缓冲）
  │ Topic: agent-logs
  │ Partition: by session_id
  │
  ▼
Elasticsearch / ClickHouse
  │
  ▼
Grafana / Kibana
```

### 关键日志查询

```
# 查询某会话的完整调用链
{agent_logs}
  | session_id = "sess-01HV3WWZP"
  | time_range = "last 1h"
  | order by timestamp

# 查询工具调用失败
{agent_logs}
  | event = "agent.tool.call_error"
  | tool_name = "web_search"
  | time_range = "last 30m"

# 查询延迟异常的会话
{agent_logs}
  | event = "agent.message"
  | duration_ms > 30000
  | time_range = "last 1h"

# 查询循环调用的工具
{agent_logs}
  | event = "agent.tool.call_start"
  | tool_name = "web_search"
  | group by session_id, count()
  | having count() > 5
```

---

## 7. SLO / SLA 监控

### SLO 定义

| SLO | 目标 | 测量窗口 |
|-----|------|----------|
| 首次响应延迟 P99 | < 500ms | 30d 滚动 |
| Token 间延迟 P99 | < 100ms | 30d 滚动 |
| 工具调用成功率 | > 99.5% | 30d 滚动 |
| 工具调用延迟 P99 | < 2s | 30d 滚动 |
| 评估质量分数 | > 0.85 | 30d 滚动 |

### 错误预算监控

```
Error Budget = (1 - SLO Target) × Total Requests

例如：30 天总请求 = 10^8 次
SLO: 工具调用成功率 > 99.5%
Error Budget = 0.5% × 10^8 = 5 × 10^5 次失败

消耗速率监控：
  - 过去 1h 失败数 = 100
  - 预计 30d 消耗 = 100 × 24 × 30 = 72,000
  - 消耗率 = 72,000 / 500,000 = 14.4%

如果消耗率 > 50%，触发 SLO 告警
```
