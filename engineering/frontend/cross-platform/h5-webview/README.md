# H5 / WebView

跨端能力训练 —— WebView 容器、认证、离线包、白屏治理。

## 核心文档

| 文档 | 内容 |
|------|------|
| [container-design.md](container-design.md) | WebView 容器设计：UA、注入、生命周期、导航栏联动 |
| [offline-package.md](offline-package.md) | 离线包系统：预下载、校验、灰度、回滚、增量更新 |
| [auth-bridge.md](auth-bridge.md) | 登录态联动：Cookie、Token、SSO、刷新策略 |
| [white-screen-debug.md](white-screen-debug.md) | 白屏治理：监控、定位、自动降级 |

## 核心主题速览

| 主题 | 关键点 |
|------|--------|
| Container | UA、注入、生命周期、导航 |
| Auth | cookie、token、SSO、刷新 |
| Offline Package | 预下载、校验、灰度、回滚 |
| White Screen | 首屏、资源失败、JS 错误、容器异常 |
| Performance | preload、prefetch、缓存、骨架屏 |
| Debug | vConsole、remote debug、日志上报 |

## 追问

- WebView 白屏如何定位？（加载阶段 / 解析阶段 / 渲染阶段）
- 离线包版本和后端 API 版本如何兼容？
- 容器注入失败时 H5 如何降级？
- 登录态在 App 杀死后如何保持？（Keychain / localStorage 持久化）
