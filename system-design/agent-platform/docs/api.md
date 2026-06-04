# API

## Agent 平台 API

### 1. 会话管理 API

#### 创建会话

```http
POST /v1/agent/sessions
Content-Type: application/json
X-User-ID: {user_id}
X-Auth-Token: {jwt}

{
  "agent_id": "agent-doc-assistant",
  "title": "帮我写技术文档",
  "config": {
    "temperature": 0.7,
    "max_tokens": 4096,
    "tools": ["web_search", "code_interpreter"],
    "memory_type": "semantic"
  }
}
```

响应：

```json
{
  "session_id": "sess-01HV3WWZP1A3B5C6D7E8F9G0H",
  "agent_id": "agent-doc-assistant",
  "title": "帮我写技术文档",
  "created_at": "2024-06-01T10:00:00Z",
  "status": "active"
}
```

#### 获取会话详情

```http
GET /v1/agent/sessions/{session_id}
```

响应：

```json
{
  "session_id": "sess-01HV3WWZP1A3B5C6D7E8F9G0H",
  "agent_id": "agent-doc-assistant",
  "title": "帮我写技术文档",
  "status": "active",
  "created_at": "2024-06-01T10:00:00Z",
  "updated_at": "2024-06-01T10:30:00Z",
  "message_count": 24,
  "context_tokens": 3200,
  "context_limit": 8192
}
```

#### 列出用户会话

```http
GET /v1/agent/sessions?user_id={user_id}&status=active&limit=20
```

#### 删除会话

```http
DELETE /v1/agent/sessions/{session_id}
```

---

### 2. Agent 执行 API

#### 发送消息（同步）

```http
POST /v1/agent/sessions/{session_id}/messages
Content-Type: application/json

{
  "content": "帮我查找今年 AI 领域的最新进展",
  "stream": false
}
```

响应：

```json
{
  "message_id": "msg-01HV3WWZP1A3B5C6D7E8F9G0H",
  "role": "user",
  "content": "帮我查找今年 AI 领域的最新进展",
  "created_at": "2024-06-01T10:00:00Z"
}
```

#### 发送消息（流式，SSE）

```http
POST /v1/agent/sessions/{session_id}/messages
Content-Type: application/json

{
  "content": "帮我查找今年 AI 领域的最新进展",
  "stream": true
}
```

SSE 响应流：

```
event: message_start
data: {"message_id": "msg-01HV3WWZP...", "type": "assistant"}

event: text_delta
data: {"message_id": "msg-01HV3WWZP...", "content": "根据"}

event: text_delta
data: {"message_id": "msg-01HV3WWZP...", "content": "搜索"}

event: tool_call_start
data: {"message_id": "msg-01HV3WWZP...", "tool_call": {"name": "web_search", "arguments": {...}}}

event: tool_call_end
data: {"message_id": "msg-01HV3WWZP...", "tool_call": {"name": "web_search", "result": {...}}}

event: text_delta
data: {"message_id": "msg-01HV3WWZP...", "content": "以下是今年 AI 的最新进展..."}

event: message_end
data: {"message_id": "msg-01HV3WWZP...", "usage": {"tokens": 1234}}
```

#### 流式事件类型

| 事件类型 | 说明 | 载荷 |
|----------|------|------|
| `message_start` | 消息开始 | `{message_id, role}` |
| `text_delta` | 文本增量 | `{message_id, content}` |
| `tool_call_start` | 工具调用开始 | `{message_id, tool_call}` |
| `tool_call_end` | 工具调用结束 | `{message_id, tool_call, result}` |
| `tool_call_error` | 工具调用失败 | `{message_id, tool_call, error}` |
| `error` | 错误 | `{code, message}` |
| `message_end` | 消息结束 | `{message_id, usage, finish_reason}` |
| `cancelled` | 用户取消 | `{message_id}` |

#### 取消执行

```http
POST /v1/agent/sessions/{session_id}/cancel
Content-Type: application/json

{
  "message_id": "msg-01HV3WWZP..."
}
```

---

### 3. 工具管理 API

#### 注册工具

```http
POST /v1/agent/tools
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "name": "web_search",
  "description": "搜索互联网获取最新信息",
  "provider": "external",
  "schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜索关键词"
      },
      "max_results": {
        "type": "integer",
        "description": "最大结果数",
        "default": 10
      }
    },
    "required": ["query"]
  },
  "timeout_ms": 5000,
  "retry_config": {
    "max_attempts": 3,
    "initial_delay_ms": 1000,
    "backoff_multiplier": 2
  },
  "permissions": ["user:active"],
  "side_effects": false,
  "enabled": true
}
```

响应：

```json
{
  "tool_id": "tool-web_search",
  "name": "web_search",
  "version": "v1",
  "created_at": "2024-06-01T10:00:00Z"
}
```

#### 获取工具列表

```http
GET /v1/agent/tools?enabled=true&page=1&page_size=50
```

#### 获取工具详情

```http
GET /v1/agent/tools/{tool_name}
```

#### 更新工具

```http
PUT /v1/agent/tools/{tool_name}
Content-Type: application/json

{
  "config": {
    "timeout_ms": 10000,
    "enabled": true
  }
}
```

---

### 4. 记忆管理 API

#### 添加记忆

```http
POST /v1/agent/memory
Content-Type: application/json

{
  "user_id": "u12345",
  "type": "preference",
  "content": "用户更喜欢详细的技术解释",
  "importance": "high",
  "source": "conversation"
}
```

#### 检索记忆

```http
POST /v1/agent/memory/search
Content-Type: application/json

{
  "user_id": "u12345",
  "query": "技术解释偏好",
  "limit": 5
}
```

响应：

```json
{
  "memories": [
    {
      "memory_id": "mem-abc123",
      "content": "用户更喜欢详细的技术解释",
      "relevance_score": 0.92,
      "type": "preference",
      "created_at": "2024-05-15T10:00:00Z"
    }
  ]
}
```

#### 删除记忆

```http
DELETE /v1/agent/memory/{memory_id}
```

---

### 5. 评估 API

#### 创建评估任务

```http
POST /v1/agent/eval/tasks
Content-Type: application/json

{
  "name": "doc_assistant_quality_eval",
  "agent_id": "agent-doc-assistant",
  "dataset": {
    "type": "golden_set",
    "id": "golden_set_doc_001"
  },
  "metrics": ["accuracy", "relevance", "safety"],
  "sample_size": 100
}
```

#### 获取评估结果

```http
GET /v1/agent/eval/tasks/{task_id}
```

响应：

```json
{
  "task_id": "eval-task-001",
  "status": "completed",
  "results": {
    "accuracy": 0.85,
    "relevance": 0.92,
    "safety": 0.99,
    "overall_score": 0.89
  },
  "summary": {
    "total_samples": 100,
    "passed": 89,
    "failed": 11,
    "regression": false
  },
  "completed_at": "2024-06-01T12:00:00Z"
}
```

---

## Event Contract

| Event | 触发时机 | 消费者 |
|-------|---------|--------|
| `agent.session.created` | 会话创建 | 统计、审计 |
| `agent.message.sent` | 用户发送消息 | 上下文管理 |
| `agent.message.stream_start` | Agent 开始流式输出 | 前端渲染 |
| `agent.message.stream_end` | 流式输出结束 | 统计、评估 |
| `agent.tool.call_start` | 工具调用开始 | 日志、监控 |
| `agent.tool.call_end` | 工具调用结束 | 日志、评估 |
| `agent.tool.call_error` | 工具调用失败 | 告警、重试逻辑 |
| `agent.tool.call_retry` | 工具重试 | 统计 |
| `agent.memory.stored` | 记忆存储 | 记忆系统 |
| `agent.memory.retrieved` | 记忆检索 | 上下文构建 |
| `agent.eval.started` | 评估开始 | 评估系统 |
| `agent.eval.completed` | 评估完成 | 告警、回归检测 |
| `agent.cancelled` | 执行被取消 | 状态更新、资源清理 |
| `agent.error` | Agent 执行错误 | 告警、用户通知 |
