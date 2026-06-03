# Go 的演进：从 1.0 到 1.24

| 版本 | 年份 | 里程碑 | 哲学一致性 |
|------|------|--------|-----------|
| **Go 1.0** | 2012 | 语言稳定承诺 | 基础设计语言冻结 |
| **Go 1.5** | 2015 | 自举编译器（Go 写 Go） | 工程能力的自我验证 |
| **Go 1.7** | 2016 | `context` 进入标准库 | 取消传播成为一等公民 |
| **Go 1.11** | 2018 | Go Modules | 依赖管理的工程化解决 |
| **Go 1.13** | 2019 | `errors.Is`/`errors.As` | error 系统的渐进完善 |
| **Go 1.16** | 2020 | `embed`、io/fs | 工程设施扩展 |
| **Go 1.18** | 2022 | **泛型** | 「最小可用」原则的胜利 |
| **Go 1.20** | 2023 | `context.WithCancelCause`、`slog` | 错误链、结构化日志 |
| **Go 1.21** | 2023 | PGO（Profile Guided Optimization）、slices/maps 包 | 编译器智能进化 |
| **Go 1.22** | 2024 | `for range int`、fix 循环变量 | 语法糖极其克制地增加 |

## 观察

Go 的演进非常保守。13 年才加入泛型，22 年仍不加入三元运算符。每次增加特性都经过激烈社区讨论，核心团队坚持「特性有代价」。

> "A feature is not done when there's nothing left to add, but when there's nothing left to remove." — Go 团队的设计倾向
