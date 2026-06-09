# Lynx

跨端能力训练 —— Lynx 架构原理、DSL 编译、首屏直出、原生集成。

## 核心文档

| 文档 | 内容 |
|------|------|
| [architecture.md](architecture.md) | Radon 渲染架构、DSL → Lepus/Tasm → 原生渲染、PrimJS 引擎 |
| [application.md](application.md) | 简化版内容 App：瀑布流、视频播放、评论区 |
| [components.md](components.md) | 跨端组件设计：Element 体系、PAPI 封装、平台差异化处理 |
| [native-integration.md](native-integration.md) | Element PAPI 原生扩展、Native Module 封装、音视频 SDK 桥接 |
| [performance.md](performance.md) | TTF 首屏直出、列表优化、内存管理、Bundle 拆分 |
| [devtool-debug.md](devtool-debug.md) | Lynx DevTool、性能分析、内存泄漏定位、线上监控 |

## 核心主题速览

| 主题 | 关键点 |
|------|--------|
| DSL | 类 React/Vue 语法，编译为 Lynx 专用运行时 |
| Radon | 双线程渲染架构，JS 逻辑与 Native 渲染分离 |
| PrimJS | 自研 JS 引擎，专为移动端优化启动与内存 |
| TTF | Template First Rendering，首屏不依赖 JS 执行 |
| Lepus/Tasm | 编译产物：逻辑层脚本 + 模板描述 |
| Element | 原生 UI 组件的跨端抽象 |
| PAPI | Platform API，原生能力暴露接口 |

## 追问

- Lynx 的 TTF 为什么比 RN 的 Bridge 架构首屏更快？
- DSL 编译后的 Lepus 和 Tasm 分别承担什么职责？
- PrimJS 与 Hermes、JSC 相比有什么取舍？
- Element PAPI 和 RN 的 TurboModule 有什么本质区别？
- Lynx 如何实现列表的细粒度更新与回收复用？
