package minitool

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

// ===== Schema 参数定义（简化 JSON Schema） =====

type Schema struct {
	Type       string            `json:"type"` // object
	Required   []string          `json:"required"`
	Properties map[string]Schema `json:"properties"`
}

// Validate 校验输入参数
func (s Schema) Validate(input map[string]any) error {
	if s.Type != "object" {
		return nil
	}
	for _, req := range s.Required {
		if _, ok := input[req]; !ok {
			return fmt.Errorf("missing required parameter: %q", req)
		}
	}
	for key, sub := range s.Properties {
		if val, ok := input[key]; ok {
			if sub.Type == "string" {
				if _, ok := val.(string); !ok {
					return fmt.Errorf("parameter %q must be string, got %T", key, val)
				}
			}
			if sub.Type == "number" {
				switch val.(type) {
				case float64, int, int64:
					// ok
				default:
					return fmt.Errorf("parameter %q must be number, got %T", key, val)
				}
			}
			if sub.Type == "boolean" {
				if _, ok := val.(bool); !ok {
					return fmt.Errorf("parameter %q must be boolean, got %T", key, val)
				}
			}
			if sub.Type == "array" {
				if _, ok := val.([]any); !ok {
					return fmt.Errorf("parameter %q must be array, got %T", key, val)
				}
			}
		}
	}
	return nil
}

// ===== Tool 定义 =====

// ToolFunc 工具执行函数签名
type ToolFunc func(ctx context.Context, args map[string]any) (any, error)

// Tool 工具元数据
type Tool struct {
	Name        string
	Description string
	Schema      Schema
	Run         ToolFunc
}

// ===== Registry 工具注册表 =====

type Registry struct {
	mu    sync.RWMutex
	tools map[string]Tool
}

func NewRegistry() *Registry {
	return &Registry{tools: make(map[string]Tool)}
}

// Register 注册工具
func (r *Registry) Register(t Tool) error {
	if t.Name == "" {
		return errors.New("tool name is required")
	}
	if t.Run == nil {
		return errors.New("tool run function is required")
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.tools[t.Name]; ok {
		return fmt.Errorf("tool %q already registered", t.Name)
	}
	r.tools[t.Name] = t
	return nil
}

// Get 获取工具
func (r *Registry) Get(name string) (Tool, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.tools[name]
	return t, ok
}

// List 列出所有工具
func (r *Registry) List() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Tool, 0, len(r.tools))
	for _, t := range r.tools {
		out = append(out, t)
	}
	return out
}

// ToOpenAIFormat 输出 OpenAI function calling 格式（方便对接 LLM）
func (r *Registry) ToOpenAIFormat() []map[string]any {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]map[string]any, 0, len(r.tools))
	for _, t := range r.tools {
		out = append(out, map[string]any{
			"type": "function",
			"function": map[string]any{
				"name":        t.Name,
				"description": t.Description,
				"parameters":  t.Schema,
			},
		})
	}
	return out
}

// ===== Event 事件流 =====

type EventType string

const (
	EventStart EventType = "tool.start"
	EventDone  EventType = "tool.done"
	EventError EventType = "tool.error"
)

type Event struct {
	Type      EventType
	Tool      string
	Input     map[string]any
	Output    any
	Error     error
	Duration  time.Duration
	Timestamp time.Time
}

// EventHandler 事件回调
type EventHandler func(Event)

// ===== Runner 执行器 =====

type Runner struct {
	registry *Registry
	timeout  time.Duration
	handlers []EventHandler
}

func NewRunner(reg *Registry, timeout time.Duration) *Runner {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &Runner{
		registry: reg,
		timeout:  timeout,
	}
}

// OnEvent 注册事件监听
func (r *Runner) OnEvent(h EventHandler) {
	r.handlers = append(r.handlers, h)
}

// Run 同步执行工具
func (r *Runner) Run(ctx context.Context, name string, args map[string]any) (any, error) {
	tool, ok := r.registry.Get(name)
	if !ok {
		return nil, fmt.Errorf("tool %q not found", name)
	}

	// 参数校验
	if err := tool.Schema.Validate(args); err != nil {
		return nil, fmt.Errorf("validation: %w", err)
	}

	// 事件：开始
	start := time.Now()
	r.emit(Event{
		Type:      EventStart,
		Tool:      name,
		Input:     args,
		Timestamp: start,
	})

	// 执行（带超时）
	ctx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()

	output, err := tool.Run(ctx, args)

	// 事件：结束/错误
	event := Event{
		Type:      EventDone,
		Tool:      name,
		Input:     args,
		Output:    output,
		Duration:  time.Since(start),
		Timestamp: time.Now(),
	}
	if err != nil {
		event.Type = EventError
		event.Error = err
	}
	r.emit(event)

	if err != nil {
		return nil, fmt.Errorf("tool %q failed: %w", name, err)
	}
	return output, nil
}

// RunAsync 异步执行，返回结果 channel
func (r *Runner) RunAsync(ctx context.Context, name string, args map[string]any) <-chan Result {
	ch := make(chan Result, 1)
	go func() {
		output, err := r.Run(ctx, name, args)
		ch <- Result{Output: output, Error: err}
		close(ch)
	}()
	return ch
}

// RunBatch 批量执行多个工具，返回有序结果
func (r *Runner) RunBatch(ctx context.Context, tasks []TaskCall) []Result {
	results := make([]Result, len(tasks))
	var wg sync.WaitGroup

	for i, task := range tasks {
		wg.Add(1)
		go func(idx int, t TaskCall) {
			defer wg.Done()
			output, err := r.Run(ctx, t.Name, t.Args)
			results[idx] = Result{Output: output, Error: err}
		}(i, task)
	}

	wg.Wait()
	return results
}

func (r *Runner) emit(e Event) {
	for _, h := range r.handlers {
		// 事件处理 panic 不崩主流程
		func() {
			defer func() { recover() }()
			h(e)
		}()
	}
}

// ===== 辅助类型 =====

type TaskCall struct {
	Name string
	Args map[string]any
}

type Result struct {
	Output any
	Error  error
}

// JSONArgs 把 JSON 字符串解析成 map[string]any
func JSONArgs(s string) (map[string]any, error) {
	var args map[string]any
	if err := json.Unmarshal([]byte(s), &args); err != nil {
		return nil, fmt.Errorf("parse tool args: %w", err)
	}
	return args, nil
}