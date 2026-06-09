# CLI / TUI / AI Agent CLI

Node.js 是构建命令行工具、终端用户界面（TUI）和 AI Agent CLI 的首选平台。本模块覆盖从简单脚本到复杂 AI 交互界面的完整设计能力。

## 能力层级

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 CLI Script | 参数解析、颜色输出、文件操作 | 能写效率工具 |
| L2 Interactive CLI | Prompt、Spinner、Progress、表格 | 能写向导式 CLI |
| L3 TUI | Ink / Blessed、实时数据、键盘交互 | 能写终端 GUI |
| L4 AI Agent CLI | 流式输出、Tool 渲染、多轮对话、Context | 能写 AI 原生 CLI |
| L5 Process Orchestration | 子进程、PTY、REPL、Shell 集成 | 能写命令编排平台 |

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| CLI Design | `cli-design/` | 参数解析、交互式 Prompt、视觉反馈、颜色输出 |
| TUI Design | `tui-design/` | Ink（React for Terminal）、Blessed（传统 TUI） |
| AI Agent CLI | `ai-agent-cli/` | 流式输出、Tool 渲染、多轮对话、上下文管理 |
| REPL Design | `repl-design/` | 交互式解释器、多行输入、历史记录 |
| Process Interaction | `process-interaction/` | Child Process、PTY、实时流、安全执行 |

## 核心题单

| 优先级 | 资产 | 目录 | 状态 |
| --- | --- | --- | --- |
| P0 | CLI argument parser | `cli-design/argument-parser/` | done |
| P0 | Interactive prompts | `cli-design/interactive-prompt/` | done |
| P0 | Colored output | `cli-design/colored-output/` | done |
| P0 | AI streaming output | `ai-agent-cli/streaming-output/` | done |
| P0 | Multi-turn chat | `ai-agent-cli/multi-turn-chat/` | done |
| P1 | Spinners & progress | `cli-design/spinners-progress/` | done |
| P1 | Ink React TUI | `tui-design/ink-react-terminal/` | done |
| P1 | Blessed terminal | `tui-design/blessed-terminal/` | done |
| P1 | Tool rendering | `ai-agent-cli/tool-rendering/` | done |
| P1 | Context management | `ai-agent-cli/context-management/` | done |
| P1 | REPL design | `repl-design/` | done |
| P1 | Child process | `process-interaction/child-process/` | done |
| P1 | PTY terminal | `process-interaction/pty-terminal/` | done |

## 架构师级追问

- CLI 参数解析如何防止 shell 注入？
- 无 TTY 环境（CI）如何优雅降级 spinner？
- TUI 框架 Ink 和 Blessed 如何选型？
- AI 流式输出如何避免终端闪烁和 Unicode 截断？
- Tool calling 在 CLI 中如何展示才既清晰又不打扰？
- 多轮对话的上下文窗口如何管理？
- REPL 如何安全执行用户输入的代码？
- PTY 与 spawn 的本质区别是什么？
