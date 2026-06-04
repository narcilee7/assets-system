# Data Model

## 核心设计原则

- **工具 Schema 标准化**：所有工具使用统一的 schema 描述
- **会话状态可恢复**：所有状态持久化，支持断连恢复
- **记忆分层管理**：短期/长期/情景/语义分层
- **执行链路可追溯**：所有操作可审计、可回放

---

## 1. 会话数据模型

### 会话（Session）

```sql
CREATE TABLE agent_sessions (
    id              VARCHAR(64) PRIMARY KEY,
    user_id         VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL,
    agent_id        VARCHAR(64) NOT NULL,

    -- 会话元信息
    title           VARCHAR(256),
    status          ENUM('active', 'paused', 'completed', 'cancelled') DEFAULT 'active',

    -- 配置
    config          JSON,          -- temperature, max_tokens, tools 等
    system_prompt   TEXT,

    -- 上下文统计
    context_tokens  INT DEFAULT 0,
    message_count   INT DEFAULT 0,

    -- 时间
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ended_at        TIMESTAMP,

    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
);
```

### 消息（Message）

```sql
CREATE TABLE agent_messages (
    id              VARCHAR(64) PRIMARY KEY,
    session_id      VARCHAR(64) NOT NULL,

    -- 消息内容
    role            ENUM('user', 'assistant', 'system', 'tool') NOT NULL,
    content         TEXT,
    content_tokens  INT,

    -- 元信息
    metadata        JSON,          -- 来源、引用等
    finish_reason   VARCHAR(32),

    -- 工具调用
    tool_calls      JSON,          -- [{name, arguments, result, error}]

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_session (session_id),
    INDEX idx_created (created_at)
);
```

### 上下文窗口（In-Memory）

```go
type ContextWindow struct {
    MaxTokens      int
    Messages       []*Message      // 有序消息列表
    TotalTokens    int

    // 截断策略
    TruncationStrategy string  // "keep_recent" | "keep_first" | "smart"
}

func (c *ContextWindow) Add(msg *Message) {
    c.Messages = append(c.Messages, msg)
    c.TotalTokens += msg.Tokens

    // 超过窗口则截断
    if c.TotalTokens > c.MaxTokens {
        c.Truncate()
    }
}
```

---

## 2. 工具数据模型

### 工具定义（Tool Definition）

```go
type Tool struct {
    Name        string
    Description string
    Provider    string  // "builtin" | "external" | "user_defined"

    // JSON Schema
    Schema       *JSONSchema
    Parameters   map[string]Parameter

    // 执行配置
    Timeout      time.Duration
    RetryConfig  *RetryConfig
    RateLimit    *RateLimit

    // 权限与安全
    Permissions  []string           // ["user:active", "admin"]
    SideEffects  bool               // 是否有副作用
    Dangerous    bool               // 是否危险操作

    Enabled      bool
}
```

### 工具调用记录

```sql
CREATE TABLE tool_executions (
    id              VARCHAR(64) PRIMARY KEY,
    message_id      VARCHAR(64) NOT NULL,
    session_id      VARCHAR(64) NOT NULL,

    -- 工具信息
    tool_name       VARCHAR(64) NOT NULL,
    arguments       JSON,
    result          JSON,
    error           TEXT,

    -- 执行统计
    status          ENUM('pending', 'running', 'success', 'failed', 'cancelled') DEFAULT 'pending',
    duration_ms     INT,
    attempts        INT DEFAULT 1,

    -- 安全
    user_id         VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_session (session_id),
    INDEX idx_tool (tool_name),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
);
```

### 工具 Schema 示例

```json
// web_search 工具 schema
{
  "name": "web_search",
  "description": "搜索互联网获取最新信息",
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
      },
      "time_range": {
        "type": "string",
        "enum": ["day", "week", "month", "year"],
        "description": "时间范围"
      }
    },
    "required": ["query"]
  },
  "timeout_ms": 5000,
  "side_effects": false,
  "rate_limit": {
    "requests_per_minute": 60
  }
}
```

---

## 3. 记忆数据模型

### 记忆存储

```sql
CREATE TABLE agent_memories (
    id              VARCHAR(64) PRIMARY KEY,
    user_id         VARCHAR(64) NOT NULL,

    -- 记忆内容
    type            ENUM('preference', 'fact', 'context', 'knowledge') NOT NULL,
    content         TEXT NOT NULL,

    -- 语义向量（用于检索）
    embedding       BLOB(512),       -- 512 维 float32

    -- 元信息
    importance      ENUM('low', 'medium', 'high') DEFAULT 'medium',
    source          VARCHAR(64),     -- 来源：conversation / explicit / inferred
    metadata        JSON,

    -- 统计
    access_count    INT DEFAULT 0,
    last_accessed_at TIMESTAMP,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_user_type (user_id, type),
    INDEX idx_importance (user_id, importance),
    INDEX idx_created (created_at)
);
```

### 记忆层级架构

```
┌─────────────────────────────────────────┐
│         短期记忆（Short-Term）            │
│  容量：当前会话内的上下文                  │
│  存储：Redis，TTL = 会话时长              │
│  特点：完整保留，无压缩                   │
├─────────────────────────────────────────┤
│         情景记忆（Episodic）             │
│  容量：会话级别的经验                      │
│  存储：MySQL，按时间组织                   │
│  特点：压缩为摘要，保留关键事件            │
├─────────────────────────────────────────┤
│         语义记忆（Semantic）              │
│  容量：事实性知识                          │
│  存储：向量数据库，语义检索                │
│  特点：跨会话共享，全量保留                │
├─────────────────────────────────────────┤
│         偏好记忆（Preference）            │
│  容量：用户偏好                            │
│  存储：MySQL，结构化                      │
│  特点：按实体组织，有优先级                │
└─────────────────────────────────────────┘
```

### 记忆检索

```go
type MemoryRetrieval struct {
    // 1. 查询重写（Query Rewriting）
    query := rewriteQuery(userQuery)  // "帮我找个附近餐厅" → "用户位置偏好，餐厅推荐"

    // 2. 多路检索
    var results []*Memory

    // 2.1 语义检索（向量相似度）
    semanticResults := vectorDB.Search(query, topK)

    // 2.2 关键词检索
    keywordResults := fullTextSearch(query, topK)

    // 2.3 结构化检索（偏好记忆）
    structuredResults := db.Query("""
        SELECT * FROM agent_memories
        WHERE user_id = ? AND type = 'preference'
        AND content LIKE '%餐厅%'
    """, userID)

    // 3. 结果融合（ Reciprocal Rank Fusion）
    fused := RRF(semanticResults, keywordResults, structuredResults)

    // 4. 过滤和排序
    return filterAndRank(fused, query)
}
```

---

## 4. 执行计划数据模型

### 任务执行计划

```go
type Plan struct {
    TaskID      string
    Goal        string
    Steps       []*Step
    CurrentStep int
    Status      PlanStatus  // planning / executing / completed / failed / cancelled
}

type Step struct {
    StepID      string
    Description string
    ToolName    string
    Arguments   map[string]interface{}
    Dependencies []string  // 前置步骤 ID

    // 执行状态
    Status      StepStatus  // pending / running / success / failed / skipped
    Result      interface{}
    Error       error
}
```

### 规划状态持久化

```sql
CREATE TABLE agent_plans (
    id              VARCHAR(64) PRIMARY KEY,
    session_id      VARCHAR(64) NOT NULL,
    message_id      VARCHAR(64) NOT NULL,

    -- 计划内容
    goal            TEXT,
    steps           JSON,          -- [{step_id, description, tool_name, arguments, dependencies, status, result}]
    current_step    INT DEFAULT 0,
    status          ENUM('planning', 'executing', 'completed', 'failed', 'cancelled') DEFAULT 'planning',

    -- 循环检测
    loop_count      INT DEFAULT 0,
    repeated_tools  JSON,          -- 重复调用的工具及其次数

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_session (session_id)
);
```

---

## 5. 流式输出状态模型

### 任务状态

```go
type StreamTask struct {
    TaskID       string
    MessageID    string
    SessionID    string

    // 状态
    Status       StreamStatus  // initial / streaming / completed / cancelled / failed

    // 输出缓冲
    TextBuffer   []string

    // 工具调用状态
    ToolCalls    []*ToolCallState

    // 统计
    TokensGenerated int
    StartedAt    time.Time
    EndedAt      time.Time
}

type ToolCallState struct {
    ToolName    string
    Arguments   map[string]interface{}
    Status      ToolCallStatus  // pending / running / success / failed
    Result      interface{}
    Error       error
    Duration    time.Duration
}
```

### 断点恢复

```
当用户断连重连时：
  1. 查询 StreamTask（根据 session_id + message_id）
  2. 获取当前状态（已生成的文本、已完成工具调用）
  3. 返回 "resume" 事件，告知前端从哪个位置恢复
  4. 前端从断点继续渲染
```

---

## 6. 评估数据模型

### 评估数据集

```sql
CREATE TABLE eval_datasets (
    id              VARCHAR(64) PRIMARY KEY,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    type            ENUM('golden_set', 'synthetic', 'production_sample') NOT NULL,
    version         VARCHAR(32),

    -- 样本数量
    sample_count    INT,

    -- 元信息
    created_by      VARCHAR(64),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_name (name)
);
```

### 评估样本

```sql
CREATE TABLE eval_samples (
    id              VARCHAR(64) PRIMARY KEY,
    dataset_id      VARCHAR(64) NOT NULL,

    -- 输入
    input           JSON,          -- {user_query, session_context, expected_behavior}

    -- 期望输出
    expected_output JSON,          -- {response, tools_to_call, final_answer}

    -- 元信息
    difficulty      ENUM('easy', 'medium', 'hard'),
    tags            JSON,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_dataset (dataset_id)
);
```

### 评估结果

```sql
CREATE TABLE eval_results (
    id              VARCHAR(64) PRIMARY KEY,
    task_id         VARCHAR(64) NOT NULL,
    sample_id       VARCHAR(64) NOT NULL,
    model_version   VARCHAR(32),

    -- 评估指标
    metrics         JSON,          -- {accuracy, relevance, safety, ...}
    overall_score   DECIMAL(5,4),

    -- 详细结果
    actual_output   JSON,
    passed          BOOLEAN,
    error_message   TEXT,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_task (task_id),
    INDEX idx_sample (sample_id),
    INDEX idx_model (model_version)
);
```

---

## 7. 安全与权限数据模型

### 权限定义

```go
type Permission struct {
    // 主体
    SubjectType  string  // "user" | "role" | "tenant"
    SubjectID    string

    // 客体
    ObjectType   string  // "tool" | "memory" | "session"
    ObjectID     string

    // 操作
    Actions      []string  // "invoke" | "read" | "write" | "delete"

    // 条件
    Conditions   map[string]interface{}  // 时间、IP 等条件
}
```

### 数据边界

```sql
CREATE TABLE data_boundaries (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    user_id         VARCHAR(64),

    -- 数据范围
    data_type       ENUM('user_data', 'org_data', 'shared_data') NOT NULL,
    resource_pattern VARCHAR(256),   -- "user:{user_id}:*" 允许访问的资源模式

    -- 权限级别
    permission_level ENUM('none', 'read', 'write', 'admin') DEFAULT 'none',

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 审计日志

```sql
CREATE TABLE agent_audit_logs (
    id              VARCHAR(64) PRIMARY KEY,
    timestamp       TIMESTAMP NOT NULL,

    -- 操作者
    user_id         VARCHAR(64),
    tenant_id       VARCHAR(64),

    -- 操作对象
    action          VARCHAR(64) NOT NULL,  -- "invoke_tool" | "access_memory" | "session_create"
    object_type     VARCHAR(64),
    object_id       VARCHAR(64),

    -- 上下文
    session_id      VARCHAR(64),
    ip_address      VARCHAR(64),
    user_agent      TEXT,

    -- 结果
    status          ENUM('success', 'failure', 'denied') NOT NULL,
    error_message   TEXT,

    INDEX idx_user_time (user_id, timestamp),
    INDEX idx_object (object_type, object_id),
    INDEX idx_timestamp (timestamp)
);
```
