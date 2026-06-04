# Read & Write Path

## Agent 执行主流程

```
用户发送消息
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 0: 上下文构建                                    │
│  1. 加载会话历史（短期记忆）                             │
│  2. 检索长期记忆（用户偏好、相关知识）                    │
│  3. 构建系统提示（Agent 配置 + 用户偏好）                │
│  4. 上下文窗口截断（如果超出限制）                       │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: 规划（Planning）                              │
│  1. LLM 分析用户意图                                     │
│  2. 拆解为任务步骤                                       │
│  3. 判断是否需要调用工具                                  │
│  4. 生成执行计划（Plan）                                 │
│  5. 检查循环（是否重复执行相同工具）                      │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 2: 工具执行（Tool Execution）                     │
│  1. 按依赖关系排序工具调用                                │
│  2. 并行执行无依赖的工具                                   │
│  3. 串行执行有依赖的工具（等待前置完成）                   │
│  4. 处理工具结果                                          │
│  5. 错误处理和重试                                        │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 3: 响应生成（Response Generation）                │
│  1. 收集所有工具结果                                      │
│  2. LLM 基于完整上下文生成最终响应                        │
│  3. 流式输出（逐 token 返回）                             │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 4: 后处理（Post-Processing）                      │
│  1. 存储消息到会话历史                                    │
│  2. 更新上下文统计                                        │
│  3. 写入长期记忆（重要信息）                              │
│  4. 触发评估（如有样本）                                  │
└─────────────────────────────────────────────────────────┘
  │
  ▼
  返回流式响应 / 最终结果
```

---

## 详细阶段分析

### PHASE 0: 上下文构建

```go
func (a *Agent) BuildContext(sessionID, userQuery string) (*Context, error) {
    // 1. 加载会话历史
    history, _ := a.LoadSessionHistory(sessionID)

    // 2. 检索长期记忆
    preferences, _ := a.memory.Search(userQuery, &MemorySearchOptions{
        Type:     "preference",
        UserID:    a.userID,
        Limit:    10,
    })
    knowledge, _ := a.memory.Search(userQuery, &MemorySearchOptions{
        Type:     "knowledge",
        UserID:    a.userID,
        Limit:    5,
    })

    // 3. 构建系统提示
    systemPrompt := a.BuildSystemPrompt(preferences, knowledge)

    // 4. 组装上下文
    context := &Context{
        SystemPrompt: systemPrompt,
        History:      history,
        UserQuery:    userQuery,
    }

    // 5. 检查并截断
    if context.Tokens > a.maxContextTokens {
        context = a.TruncateContext(context)
    }

    return context, nil
}
```

### PHASE 1: 规划（Planning）

#### 任务拆解

```go
func (a *Agent) Plan(ctx *Context) (*Plan, error) {
    // 1. LLM 生成计划
    planningPrompt := `
    你是一个任务规划助手。用户想要：{{.UserQuery}}

    请将任务拆解为可执行的步骤。每个步骤需要：
    - 描述：步骤要做什么
    - 工具：需要使用的工具（如需要）
    - 依赖：该步骤依赖的前置步骤（如有）

    以 JSON 格式返回步骤列表。
    `

    response := a.llm.Chat(planningPrompt, ctx)

    // 2. 解析计划
    plan := ParsePlan(response)

    // 3. 循环检测
    if a.DetectLoop(plan) {
        return nil, ErrLoopDetected
    }

    return plan, nil
}
```

#### 循环检测

```go
func (a *Agent) DetectLoop(plan *Plan) bool {
    toolSequence := extractToolSequence(plan.Steps)

    // 检测连续重复的工具调用
    for i := 0; i < len(toolSequence)-2; i++ {
        if toolSequence[i] == toolSequence[i+1] == toolSequence[i+2] {
            plan.LoopCount++
            if plan.LoopCount > 3 {
                return true  // 检测到 3 次以上连续重复
            }
        }
    }

    // 检测循环模式
    if hasRepeatingPattern(toolSequence, 5) {
        return true
    }

    return false
}
```

### PHASE 2: 工具执行

#### 工具调度

```go
func (a *Agent) ExecuteToolCalls(steps []*Step, ctx *Context) error {
    // 1. 构建依赖图
    dag := BuildDAG(steps)

    // 2. 拓扑排序，获取执行顺序
    sorted := dag.TopologicalSort()

    // 3. 分批执行（按层级）
    for _, batch := range sorted.Batches {
        // 并行执行同一批次的无依赖工具
        var wg sync.WaitGroup
        for _, step := range batch {
            wg.Add(1)
            go func(s *Step) {
                defer wg.Done()
                a.executeStep(s, ctx)
            }(step)
        }
        wg.Wait()

        // 收集结果，传递给下一批次
        UpdateContextWithResults(ctx, batch)
    }

    return nil
}
```

#### 工具执行器

```go
func (a *Agent) executeStep(step *Step, ctx *Context) error {
    // 1. 权限检查
    if !a.permissionChecker.CanInvoke(step.ToolName, a.userID) {
        step.Status = StepStatusFailed
        step.Error = ErrPermissionDenied
        return ErrPermissionDenied
    }

    // 2. 参数填充（从上下文获取变量）
    arguments := a.FillArguments(step.Arguments, ctx)

    // 3. 执行工具
    tool := a.toolRegistry.Get(step.ToolName)

    for attempt := 0; attempt <= tool.RetryConfig.MaxAttempts; attempt++ {
        result, err := tool.Invoke(arguments)

        if err == nil {
            step.Status = StepStatusSuccess
            step.Result = result
            return nil
        }

        // 指数退避
        if attempt < tool.RetryConfig.MaxAttempts {
            delay := tool.RetryConfig.InitialDelay * math.Pow(tool.RetryConfig.BackoffMultiplier, float64(attempt))
            time.Sleep(delay)
        }
    }

    step.Status = StepStatusFailed
    step.Error = err
    return err
}
```

### PHASE 3: 流式响应生成

#### SSE 流式输出

```go
func (a *Agent) StreamResponse(ctx *Context, plan *Plan, outputChan chan *StreamEvent) error {
    // 1. 通知开始
    outputChan <- &StreamEvent{
        Type: "message_start",
        Data: MessageStart{MessageID: ctx.MessageID},
    }

    // 2. 执行计划中的工具调用
    for _, step := range plan.Steps {
        if step.Status == StepStatusPending {
            outputChan <- &StreamEvent{
                Type: "tool_call_start",
                Data: ToolCallStart{
                    ToolCall: step.ToolName,
                    Arguments: step.Arguments,
                },
            }

            result, err := a.ExecuteTool(step)

            if err != nil {
                outputChan <- &StreamEvent{
                    Type: "tool_call_error",
                    Data: ToolCallError{
                        ToolCall: step.ToolName,
                        Error: err.Error(),
                    },
                }
            } else {
                outputChan <- &StreamEvent{
                    Type: "tool_call_end",
                    Data: ToolCallEnd{
                        ToolCall: step.ToolName,
                        Result: result,
                    },
                }
            }
        }
    }

    // 3. LLM 生成最终响应（流式）
    responseStream := a.llm.StreamChat(ctx)

    for token := range responseStream {
        outputChan <- &StreamEvent{
            Type: "text_delta",
            Data: TextDelta{Content: token},
        }
    }

    // 4. 通知结束
    outputChan <- &StreamEvent{
        Type: "message_end",
        Data: MessageEnd{
            Usage: calculateUsage(ctx),
        },
    }

    return nil
}
```

---

## 工具注册与执行

### 工具注册表

```go
type ToolRegistry struct {
    tools map[string]*Tool
    mu    sync.RWMutex
}

func (r *ToolRegistry) Register(tool *Tool) error {
    r.mu.Lock()
    r.tools[tool.Name] = tool
    r.mu.Unlock()
    return nil
}

func (r *ToolRegistry) Get(name string) *Tool {
    r.mu.RLock()
    defer r.mu.RUnlock()
    return r.tools[name]
}
```

---

## 记忆检索链路

```
用户查询 "帮我找个附近餐厅"
  │
  ▼
Query Rewriting（查询重写）
  │
  ▼
多路检索并行
  ├── 语义检索（向量搜索）
  ├── 关键词检索
  └── 结构化检索
  │
  ▼
结果融合（RRF）
  │
  ▼
返回 Top 5 记忆
```

---

## 取消与恢复

### 取消执行

```go
func (a *Agent) CancelTask(taskID string) error {
    a.activeTasksMu.Lock()
    if task := a.activeTasks[taskID]; task != nil {
        task.Cancel()
    }
    a.activeTasksMu.Unlock()

    a.llm.Cancel(task.MessageID)

    for _, step := range task.Plan.Steps {
        if step.Status == StepStatusRunning {
            step.Cancel()
        }
    }

    task.Status = TaskStatusCancelled
    return nil
}
```

### 断点恢复

```
用户断连重连 → 查询任务状态 → 返回 "resume" 事件 → 前端从断点继续渲染
```
