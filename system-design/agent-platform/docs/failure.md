# Failure Mode

## F1: 工具调用失败

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 网络超时 | 外部 API 网络延迟 | 工具返回超时错误 |
| API 限流 | 外部 API 请求频率超限 | 429 Too Many Requests |
| 认证失效 | API Token 过期 | 401 Unauthorized |
| 参数错误 | 工具参数不完整或类型错误 | 工具执行失败 |
| 死循环 | 同一个工具被重复调用 | 资源耗尽，配额耗光 |

### 应对策略

#### 1. 重试机制（指数退避）

```go
type RetryConfig struct {
    MaxAttempts      int
    InitialDelay     time.Duration
    BackoffMultiplier float64
    MaxDelay         time.Duration
}

func (t *Tool) InvokeWithRetry(args map[string]interface{}) (interface{}, error) {
    var lastErr error
    for attempt := 0; attempt <= t.RetryConfig.MaxAttempts; attempt++ {
        result, err := t.Invoke(args)
        if err == nil {
            return result, nil
        }

        lastErr = err

        // 检测是否可重试
        if !isRetryable(err) {
            return nil, err
        }

        // 指数退避
        delay := t.RetryConfig.InitialDelay *
            math.Pow(t.RetryConfig.BackoffMultiplier, float64(attempt))
        if delay > t.RetryConfig.MaxDelay {
            delay = t.RetryConfig.MaxDelay
        }

        time.Sleep(delay + jitter())
    }

    return nil, lastErr
}

func isRetryable(err error) bool {
    // 网络超时、可重试的 5xx 错误 → 可重试
    // 401、404、参数错误 → 不可重试
    if strings.Contains(err.Error(), "timeout") {
        return true
    }
    if strings.Contains(err.Error(), "502") ||
       strings.Contains(err.Error(), "503") ||
       strings.Contains(err.Error(), "504") {
        return true
    }
    return false
}
```

#### 2. 熔断器

```go
type CircuitBreaker struct {
    failures     int
    threshold    int
    resetTimeout time.Duration
    state        CircuitState  // closed / open / half_open
}

func (cb *CircuitBreaker) Allow() bool {
    if cb.state == Open {
        if time.Since(cb.lastFailure) > cb.resetTimeout {
            cb.state = HalfOpen
            return true
        }
        return false
    }
    return true
}

func (cb *CircuitBreaker) RecordFailure() {
    cb.failures++
    if cb.failures >= cb.threshold {
        cb.state = Open
        cb.lastFailure = time.Now()
    }
}
```

#### 3. 死循环防护

```go
func (a *Agent) DetectAndPreventLoop(plan *Plan) error {
    toolSequence := extractToolSequence(plan.Steps)

    // 检测连续 3 次调用同一工具
    for i := 0; i < len(toolSequence)-2; i++ {
        if toolSequence[i] == toolSequence[i+1] && toolSequence[i+1] == toolSequence[i+2] {
            return fmt.Errorf("loop detected: %s called 3 times consecutively", toolSequence[i])
        }
    }

    // 检测重复模式（如 A→B→A→B）
    if hasRepeatingPattern(toolSequence, 4) {
        return fmt.Errorf("loop detected: repeating pattern in tool sequence")
    }

    // 检测工具调用次数超限
    toolCount := countToolOccurrences(toolSequence)
    for tool, count := range toolCount {
        if count > maxToolCallLimit[tool] {
            return fmt.Errorf("tool %s called %d times, exceeds limit %d", tool, count, maxToolCallLimit[tool])
        }
    }

    return nil
}
```

---

## F2: 上下文溢出

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 长会话累积 | 多轮对话历史持续增长 | 超出模型 context 限制 |
| 大文件内容 | 用户粘贴大型代码/文档 | 上下文急剧膨胀 |
| 工具返回过大 | 工具返回了大量数据 | 上下文被工具结果填满 |

### 应对策略

#### 1. 智能截断

```go
type ContextTruncator struct {
    maxTokens     int
    preserveTypes []string  // 保留的消息类型
}

func (t *ContextTruncator) Truncate(messages []*Message) []*Message {
    // 1. 计算总 token 数
    totalTokens := sumTokens(messages)

    // 2. 如果没超限，不截断
    if totalTokens <= t.maxTokens {
        return messages
    }

    // 3. 识别关键消息（不能截断的）
    protected := identifyProtectedMessages(messages)

    // 4. 智能截断策略
    //    - 优先截断旧消息
    //    - 保留关键系统消息
    //    - 保留用户明确指示的内容
    //    - 会话开头和结尾保留更多

    result := t.smartTruncate(messages, protected, t.maxTokens)

    return result
}

func (t *ContextTruncator) smartTruncate(messages []*Message, protected []*Message, limit int) []*Message {
    // 优先保留：protected messages、recent messages、system prompts
    // 优先删除：old user messages、long tool results
    // 算法：从中间开始删，从最长的消息开始删
}
```

#### 2. 分层记忆迁移

```
策略：
  1. 当会话超过 N 条消息时
  2. 将早期关键信息提取为摘要
  3. 存入长期记忆
  4. 删除原始消息
  5. 后续对话时，从长期记忆检索补充
```

---

## F3: 流式输出中断

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 网络断开 | 用户网络不稳定 | 任务状态丢失 |
| 客户端崩溃 | 前端应用崩溃 | 用户失去连接 |
| 服务端重启 | 服务滚动升级 | 任务被中断 |

### 应对策略

#### 1. 任务状态持久化

```go
type StreamTask struct {
    TaskID        string
    MessageID     string
    SessionID     string
    Status        TaskStatus

    // 输出缓冲（持久化）
    TextBuffer    []string
    ToolCallState []*ToolCallState

    // 位置信息
    LastOutputPos string  // 最后输出的文本位置
}

func (t *StreamTask) PersistState() error {
    // 每生成一个 token，持久化状态
    return db.UpdateTaskState(t)
}
```

#### 2. 断点恢复

```go
func (s *AgentSession) ResumeTask(taskID string) (*ResumeResponse, error) {
    // 1. 查询任务状态
    task, err := s.GetTask(taskID)
    if err != nil {
        return nil, err
    }

    // 2. 判断任务是否可恢复
    if task.Status == TaskStatusCompleted {
        return &ResumeResponse{
            Type: "completed",
            Result: task.FinalResult,
        }, nil
    }

    if task.Status == TaskStatusFailed {
        return nil, fmt.Errorf("task failed: %v", task.Error)
    }

    // 3. 返回断点信息
    return &ResumeResponse{
        Type: "resume",
        ResumeFrom: task.LastOutputPos,
        TextBuffer: task.TextBuffer,
        ToolCallsCompleted: task.ToolCallState,
    }, nil
}
```

---

## F4: 记忆检索质量差

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 语义不匹配 | 查询和记忆的表述方式不同 | 检索不到相关内容 |
| 噪声过多 | 记忆内容质量参差不齐 | 检索结果相关但无用 |
| 时效性差 | 记忆过时 | Agent 给出过时建议 |

### 应对策略

#### 1. 查询重写

```go
func (m *Memory) RewriteQuery(userQuery string) string {
    prompt := fmt.Sprintf(`
    将用户查询改写为更易于检索记忆的形式。
    用户原始查询：%s

    要求：
    - 补充省略的主语（如"附近"→"用户当前位置附近"）
    - 展开缩写（如"川菜"→"川菜餐厅"）
    - 补充上下文（如"它"→"上次提到的川菜馆"）

    只返回改写后的查询，不要其他内容。
    `, userQuery)

    return llm.Chat(prompt)
}
```

#### 2. 多路检索融合

```go
func (m *Memory) Search(query string, opts *SearchOptions) ([]*Memory, error) {
    // 并行三路检索
    var wg sync.WaitGroup
    var mu sync.Mutex
    results := make([][]*Memory, 3)

    // 语义检索
    wg.Add(1)
    go func() {
        defer wg.Done()
        results[0] = m.VectorSearch(query, opts.Limit)
    }()

    // 关键词检索
    wg.Add(1)
    go func() {
        defer wg.Done()
        results[1] = m.FullTextSearch(query, opts.Limit)
    }()

    // 结构化检索
    wg.Add(1)
    go func() {
        defer wg.Done()
        results[2] = m.StructuredSearch(query, opts)
    }()

    wg.Wait()

    // RRF 融合
    fused := ReciprocalRankFusion(results, opts.Limit)

    // 去重和过滤
    return deduplicate(fused), nil
}
```

#### 3. 时效性标记

```go
type Memory struct {
    // ...
    CreatedAt   time.Time
    ExpiresAt   time.Time  // 过期时间
    Freshness   string     // "current" | "recent" | "stale"
}

func (m *Memory) ShouldUse() bool {
    if m.ExpiresAt.Before(time.Now()) {
        return false  // 已过期
    }

    // 旧记忆需要额外验证
    if m.Freshness == "stale" {
        return confirmWithUser(m)
    }

    return true
}
```

---

## F5: 安全与权限问题

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 越权访问 | 用户访问其他用户的数据 | 数据泄露 |
| 工具滥用 | 用户调用高风险工具 | 系统安全问题 |
| 提示注入 | 用户在输入中注入恶意指令 | Agent 被操纵 |
| 敏感信息泄露 | Agent 在输出中暴露敏感信息 | 隐私泄露 |

### 应对策略

#### 1. 权限检查

```go
func (p *PermissionChecker) Check(tool *Tool, userID string) error {
    // 1. 获取用户角色
    role := p.GetUserRole(userID)

    // 2. 检查工具权限
    if !contains(role.Permissions, tool.RequiredPermission) {
        return ErrPermissionDenied
    }

    // 3. 检查时间条件（如工作时间）
    if tool.HasTimeRestriction() {
        if !tool.IsWithinAllowedTime() {
            return ErrOutsideAllowedTime
        }
    }

    // 4. 检查数据边界
    if tool.HasDataBoundary() {
        if !p.IsWithinBoundary(userID, tool.DataPattern) {
            return ErrDataBoundaryViolation
        }
    }

    return nil
}
```

#### 2. 高风险操作确认

```go
func (a *Agent) ConfirmHighRiskAction(tool *Tool, args map[string]interface{}) error {
    if !tool.Dangerous {
        return nil
    }

    // 生成确认请求
    confirmMsg := fmt.Sprintf(`
    即将执行高风险操作：
    工具：%s
    参数：%v

    请确认是否继续。
    `, tool.Name, args)

    // 发送给用户确认（通过单独的信道）
    confirmed := <-a.confirmChan

    if !confirmed {
        return ErrCancelledByUser
    }

    return nil
}
```

#### 3. 输入安全检测

```go
func (a *SafetyChecker) CheckInput(content string) (*SafetyResult, error) {
    // 1. 提示注入检测
    if a.detectPromptInjection(content) {
        return &SafetyResult{
            Blocked:   true,
            Reason:    "prompt_injection",
            Sanitized: a.sanitize(content),
        }, nil
    }

    // 2. 敏感信息检测
    if containsSensitiveInfo(content) {
        return &SafetyResult{
            Blocked:   true,
            Reason:    "sensitive_info",
            Sanitized: a.maskSensitiveInfo(content),
        }, nil
    }

    return &SafetyResult{Blocked: false}, nil
}
```

---

## F6: Agent 输出质量下降

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 模型退化 | 模型更新后效果变差 | 输出质量下降 |
| 上下文稀释 | 工具结果干扰了最终响应 | 回答不相关 |
| 工具幻觉 | Agent 虚构不存在的工具调用 | 回答错误 |

### 应对策略

#### 1. 输出质量监控

```go
func (a *Agent) MonitorOutputQuality(message *Message) {
    // 1. 长度异常检测
    if len(message.Content) < 10 {
        a.alert("Suspiciously short response")
    }

    // 2. 工具幻觉检测
    if hasUncalledTools(message) {
        a.alert("Possible tool hallucination")
    }

    // 3. 自相矛盾检测
    if hasContradiction(message) {
        a.alert("Self-contradictory response")
    }
}
```

#### 2. 评估触发

```go
func (a *Agent) TriggerEvaluation(message *Message) {
    // 如果配置了实时评估
    if a.config.RealTimeEvalEnabled {
        // 异步评估
        go func() {
            result := a.evalSystem.EvaluateSingle(message)
            if result.Score < a.config.MinAcceptableScore {
                a.alert("Low quality output detected", result)
            }
        }()
    }
}
```

---

## F7: 评估系统误判

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| Judge 偏差 | Judge 模型对某些类型问题有偏见 | 误判为低质量 |
| 样本不具代表性 | Golden Set 样本不够全面 | 评估结果不准确 |
| 指标不匹配 | 自动化指标和人工评估不一致 | 优化方向错误 |

### 应对策略

#### 1. 多 Judge 验证

```go
func (a *EvalSystem) MultiJudgeEval(sample *Sample) *EvalResult {
    judges := []Judge{
        a.judgeClaude,
        a.judgeGPT4,
        a.judgeInternal,
    }

    results := make([]*JudgeResult, len(judges))
    for i, judge := range judges {
        results[i] = judge.Evaluate(sample)
    }

    // 多数投票
    return majorityVote(results)
}
```

#### 2. 持续更新 Golden Set

```
策略：
  1. 从生产流量中采样（人工标注）
  2. 覆盖边缘 case
  3. 定期更新 Golden Set
  4. 监控自动评估和人工评估的一致性
```
