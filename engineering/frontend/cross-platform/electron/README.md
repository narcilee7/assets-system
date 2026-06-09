# Electron

跨端能力训练 —— 桌面端应用开发：进程模型、IPC、安全、原生能力、自动更新。

## 核心文档

| 文档 | 内容 |
|------|------|
| [process-security.md](process-security.md) | Main / Renderer / Preload 分工、ContextIsolation、Sandbox、CSP |
| [application.md](application.md) | 简化版 Markdown 编辑器：文件系统、菜单、快捷键、托盘 |
| [ipc-patterns.md](ipc-patterns.md) | IPC 模式：Invoke/Handle、Send/On、Broadcast、TypeScript 类型安全 |
| [auto-update.md](auto-update.md) | 自动更新：差量、全量、回滚、灰度、用户提示 |

## 核心主题速览

| 主题 | 关键点 |
|------|--------|
| Process Model | main、renderer、preload |
| IPC | invoke / handle、message、type safety |
| Security | contextIsolation、sandbox、nodeIntegration |
| Native | file system、tray、shortcut、auto launch |
| Update | auto update、delta、rollback |
| Performance | cold start、memory、bundle size |

## 追问

- 为什么必须启用 contextIsolation？不启用有什么风险？
- preload 脚本应该暴露哪些 API？如何防止过度授权？
- Electron 的内存膨胀怎么治理？（进程复用、懒加载、资源释放）
- 自动更新如何做到用户无感知？更新失败如何回滚？
