# Cross Platform

跨端能力训练在多个运行容器里复用业务、统一体验，并处理平台差异。

## 主线

| 方向 | 目录 | 核心 |
| --- | --- | --- |
| React Native | `react-native/` | bridge、JSI、TurboModule、Fabric |
| JSBridge | `jsbridge/` | schema、权限、回调、版本 |
| H5 / WebView | `h5-webview/` | 容器、离线包、白屏、登录态 |
| Mini Program | `mini-program/` | 生命周期、分包、setData |
| Electron | `electron/` | main / renderer、IPC、安全、更新 |
| Hybrid Architecture | `hybrid-architecture/` | 多端能力抽象和治理 |

## 架构问题

- 能力 API 如何设计版本？
- 容器和 H5 谁负责权限？
- 离线包如何灰度和回滚？
- 多端路由和登录态如何统一？
- 如何监控 WebView 白屏和 JSBridge 失败？

