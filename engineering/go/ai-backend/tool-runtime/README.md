# Go Tool Runtime

Go 的类型安全和静态编译使其非常适合构建稳健的 AI Tool Runtime。

## 核心实现

```go
// tool_runtime.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// Tool 定义
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
	Handler     func(ctx context.Context, args map[string]interface{}) (interface{}, error)
	Timeout     time.Duration
}

// Registry
type ToolRegistry struct {
	tools map[string]Tool
}

func NewRegistry() *ToolRegistry {
	return &ToolRegistry{tools: make(map[string]Tool)}
}

func (r *ToolRegistry) Register(tool Tool) {
	r.tools[tool.Name] = tool
}

func (r *ToolRegistry) Execute(ctx context.Context, name string, args map[string]interface{}) (interface{}, error) {
	tool, ok := r.tools[name]
	if !ok {
		return nil, fmt.Errorf("tool %s not found", name)
	}

	ctx, cancel := context.WithTimeout(ctx, tool.Timeout)
	defer cancel()

	return tool.Handler(ctx, args)
}

func (r *ToolRegistry) List() []Tool {
	var list []Tool
	for _, t := range r.tools {
		list = append(list, t)
	}
	return list
}

// 注册示例工具
func main() {
	registry := NewRegistry()

	registry.Register(Tool{
		Name:        "get_weather",
		Description: "Get current weather for a city",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"city": map[string]string{"type": "string"},
				"unit": map[string]string{"type": "string", "enum": "celsius,fahrenheit"},
			},
			"required": []string{"city"},
		},
		Timeout: 5 * time.Second,
		Handler: func(ctx context.Context, args map[string]interface{}) (interface{}, error) {
			city := args["city"].(string)
			return map[string]interface{}{
				"city":        city,
				"temperature": 22,
				"condition":   "sunny",
			}, nil
		},
	})
}
```
