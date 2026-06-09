# Cross Platform

跨端能力训练 —— 在多个运行容器里复用业务、统一体验，并处理平台差异。

## 训练哲学

1. **先理解原理，再使用框架**：知道 React Native 的 Bridge 为什么慢，才能理解 JSI 的意义。
2. **从简化版到生产级**：先手写一个最小可用的 JSBridge / 离线包 / 热更新，再看业界方案。
3. **组件抽象先于实现**：跨端组件设计的核心是**能力矩阵 + 降级策略**，不是代码搬运。
4. **联动大于单端**：登录态、路由、支付、分享等必须在多端间无缝联动。

## 体系索引

### React Native
| 文档 | 内容 |
|------|------|
| [architecture.md](react-native/architecture.md) | Bridge → JSI → TurboModule → Fabric 演进与原理 |
| [application.md](react-native/application.md) | 简化版社交 App：导航、列表、详情、聊天 |
| [components.md](react-native/components.md) | 跨端组件抽象：View、Text、Image、ScrollView 平台差异处理 |
| [native-modules.md](react-native/native-modules.md) | 原生模块 SDK 封装：扫码、定位、支付、分享 |
| [state-sync.md](react-native/state-sync.md) | RN 与原生端的状态联动：登录态、未读数、深色模式 |

### JSBridge
| 文档 | 内容 |
|------|------|
| [README.md](jsbridge/README.md) | 协议设计、安全、版本、可观测性总览 |
| [implementation.md](jsbridge/implementation.md) | 简化版 JSBridge：从 URL Scheme 到 MessageChannel |
| [sdk-integration.md](jsbridge/sdk-integration.md) | 支付、分享、地图、推送等 SDK 的桥接封装 |
| [capability-detection.md](jsbridge/capability-detection.md) | 能力检测与降级：容器版本不匹配时怎么办 |

### H5 / WebView
| 文档 | 内容 |
|------|------|
| [README.md](h5-webview/README.md) | 容器、认证、离线包、白屏、性能总览 |
| [container-design.md](h5-webview/container-design.md) | WebView 容器设计：UA、注入、生命周期、导航栏 |
| [offline-package.md](h5-webview/offline-package.md) | 离线包系统：预下载、校验、灰度、回滚、增量更新 |
| [auth-bridge.md](h5-webview/auth-bridge.md) | 登录态联动：Cookie、Token、SSO、刷新策略 |
| [white-screen-debug.md](h5-webview/white-screen-debug.md) | 白屏治理：监控、定位、自动降级 |

### Mini Program
| 文档 | 内容 |
|------|------|
| [README.md](mini-program/README.md) | 生命周期、渲染层、逻辑层、setData 总览 |
| [framework-principle.md](mini-program/framework-principle.md) | 双线程模型、Virtual DOM 映射、JS 引擎隔离 |
| [application.md](mini-program/application.md) | 简化版电商小程序：首页、商品、购物车、订单 |
| [custom-components.md](mini-program/custom-components.md) | 自定义组件设计：properties、data、methods、relations |
| [cross-vendor.md](mini-program/cross-vendor.md) | 跨厂商适配：微信 / 支付宝 / 抖音差异与抹平 |

### Electron
| 文档 | 内容 |
|------|------|
| [README.md](electron/README.md) | 进程模型、IPC、安全、原生能力、更新总览 |
| [process-security.md](electron/process-security.md) | Main / Renderer / Preload 分工、ContextIsolation、Sandbox |
| [application.md](electron/application.md) | 简化版 Markdown 编辑器：文件系统、菜单、快捷键、托盘 |
| [ipc-patterns.md](electron/ipc-patterns.md) | IPC 模式：Invoke/Handle、Message、Type Safety、Broadcast |
| [auto-update.md](electron/auto-update.md) | 自动更新：差量、全量、回滚、灰度、用户提示 |

### Lynx
| 文档 | 内容 |
|------|------|
| [README.md](lynx/README.md) | DSL、Radon 架构、PrimJS、TTF 首屏直出总览 |
| [architecture.md](lynx/architecture.md) | Radon 渲染架构、DSL → Lepus/Tasm → 原生渲染、JSBinding |
| [application.md](lynx/application.md) | 简化版内容 App：瀑布流、视频播放、评论区 |
| [components.md](lynx/components.md) | Element 体系、平台差异化、自定义 Element PAPI |
| [native-integration.md](lynx/native-integration.md) | Element PAPI / Module PAPI、音视频 SDK 原生集成 |
| [performance.md](lynx/performance.md) | TTF 首屏直出、list 复用、Bundle 拆分、内存管理 |
| [devtool-debug.md](lynx/devtool-debug.md) | Lynx DevTool、性能分析、内存泄漏、线上监控 |

### Hybrid Architecture
| 文档 | 内容 |
|------|------|
| [README.md](hybrid-architecture/README.md) | 多端能力抽象和治理总览 |
| [abstraction-layer.md](hybrid-architecture/abstraction-layer.md) | 能力抽象层设计：如何将原生能力统一为 JS API |
| [unified-routing.md](hybrid-architecture/unified-routing.md) | 多端路由统一：URL Scheme、Deep Link、路由栈管理 |
| [capability-matrix.md](hybrid-architecture/capability-matrix.md) | 能力矩阵：各端能力对比、降级策略、兼容性处理 |

## 架构追问

- 能力 API 如何设计版本？旧容器遇到新 API 怎么办？
- 容器和 H5 谁负责权限？（容器管控 vs H5 自主申请）
- 离线包如何灰度和回滚？（按设备、按用户、按版本）
- 多端路由和登录态如何统一？（SSO、Token 刷新、Cookie 同步）
- 如何监控 WebView 白屏和 JSBridge 失败？（指标体系、告警阈值）
- RN 的新架构（Fabric + TurboModule）解决了什么问题？值得升级吗？
- Electron 的内存膨胀怎么治理？（进程复用、懒加载、资源释放）
