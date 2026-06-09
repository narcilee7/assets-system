# Bubble Tea TUI

Bubble Tea 是 Go 的现代 TUI 框架，基于 The Elm Architecture，组件化设计。

## 核心概念

```go
// Model: 状态
// Update: 处理消息，返回新状态
// View: 根据状态渲染 UI
```

## 列表示例

```go
// list_example.go
package main

import (
	"fmt"
	"os"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

var docStyle = lipgloss.NewStyle().Margin(1, 2)

type item struct {
	title, desc string
}

func (i item) Title() string       { return i.title }
func (i item) Description() string { return i.desc }
func (i item) FilterValue() string { return i.title }

type model struct {
	list list.Model
}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}
	case tea.WindowSizeMsg:
		h, v := docStyle.GetFrameSize()
		m.list.SetSize(msg.Width-h, msg.Height-v)
	}

	var cmd tea.Cmd
	m.list, cmd = m.list.Update(msg)
	return m, cmd
}

func (m model) View() string {
	return docStyle.Render(m.list.View())
}

func main() {
	items := []list.Item{
		item{"Deploy", "Deploy application to cluster"},
		item{"Rollback", "Rollback to previous version"},
		item{"Status", "Show service status"},
		item{"Logs", "View application logs"},
	}

	m := model{list: list.New(items, list.NewDefaultDelegate(), 0, 0)}
	m.list.Title = "Deployment Menu"

	p := tea.NewProgram(m, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Println("Error running program:", err)
		os.Exit(1)
	}
}
```

## 常用组件

| 组件 | 说明 |
| --- | --- |
| bubbles/spinner | 加载动画 |
| bubbles/progress | 进度条 |
| bubbles/textinput | 文本输入 |
| bubbles/textarea | 多行文本 |
| bubbles/table | 表格 |
| bubbles/viewport | 滚动视图 |
