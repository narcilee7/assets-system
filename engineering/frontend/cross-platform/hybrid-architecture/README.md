# Hybrid Architecture

跨端能力训练 —— 多端能力抽象和治理。

## 核心文档

| 文档 | 内容 |
|------|------|
| [abstraction-layer.md](abstraction-layer.md) | 能力抽象层设计：统一 JS API、平台适配器、SDK 封装 |
| [unified-routing.md](unified-routing.md) | 多端路由统一：URL Scheme、Deep Link、路由栈管理、路由守卫 |
| [capability-matrix.md](capability-matrix.md) | 能力矩阵：各端能力对比、降级策略、兼容性处理 |

## 核心主题速览

| 主题 | 关键点 |
|------|--------|
| 能力抽象 | 统一 API 设计、平台适配器模式 |
| 路由统一 | 多端 URL 映射、Deep Link、导航栈管理 |
| 能力矩阵 | 扫码、支付、定位、推送等能力的跨端对比 |
| 降级策略 | 功能不可用时的降级方案（上传识别、H5 收银台、静态图） |
| 版本治理 | 容器版本、API 版本、离线包版本的兼容性 |

## 追问

- 能力 API 如何设计版本？旧容器遇到新 API 怎么办？
- 容器和 H5 谁负责权限？（容器管控 vs H5 自主申请）
- 多端路由跳转时，登录态如何传递？
- 如何设计一套 SDK 同时支持 App、H5、小程序、RN？
