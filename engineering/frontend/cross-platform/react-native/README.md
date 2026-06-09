# React Native

跨端能力训练 —— React Native 架构演进、组件设计、原生模块、状态联动。

## 核心文档

| 文档 | 内容 |
|------|------|
| [architecture.md](architecture.md) | Bridge → JSI → TurboModule → Fabric 演进与原理 |
| [application.md](application.md) | 简化版社交 App：导航、列表、详情、聊天 |
| [components.md](components.md) | 跨端组件抽象：View、Text、Image、ScrollView 平台差异处理 |
| [native-modules.md](native-modules.md) | 原生模块 SDK 封装：扫码、定位、支付、分享 |
| [state-sync.md](state-sync.md) | RN 与原生端的状态联动：登录态、未读数、深色模式 |

## 核心主题速览

| 主题 | 关键点 |
|------|--------|
| Bridge | JS 与 Native 的 JSON 通信通道 |
| JSI | C++ 层共享内存，同步调用 |
| TurboModule | 懒加载、类型安全的原生模块 |
| Fabric | C++ Shadow Tree、View Flattening |
| Hermes | 字节码引擎、TIR 优化、启动加速 |
| Gesture | react-native-gesture-handler、Reanimated |

## 追问

- 为什么 FlatList 的 `getItemLayout` 能显著提升性能？
- `useNativeDriver: true` 的动画为什么流畅？
- 新架构（Fabric + TurboModule）值得升级吗？有哪些兼容性风险？
- 如何在 RN 中处理 iOS 和 Android 的导航栏高度差异？
