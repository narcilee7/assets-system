# PWA / Service Worker 工程化

PWA 工程化训练 —— 达到"能构建离线优先应用、能设计 Service Worker 策略、能优化安装体验"的水平。

## 训练哲学

1. **离线是底线，不是天花板**：用户可能在地铁、飞机上、弱网环境中使用应用。
2. **Service Worker 是代理**：它拦截网络请求，决定如何响应，是 PWA 的核心。
3. **安装体验是转化率**：Add to Home Screen 的每一步流失都是用户损失。
4. **渐进增强**：PWA 功能应该在不支持的环境中优雅降级。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-pwa-fundamentals.md](01-pwa-fundamentals.md) | PWA 基础：Web App Manifest、Service Worker 注册、安装流程、Workbox |
| [02-sw-strategies.md](02-sw-strategies.md) | SW 缓存策略：Cache First/Network First/Stale While Revalidate、路由匹配 |
| [03-offline-first.md](03-offline-first.md) | 离线优先：Background Sync、IndexedDB、离线页面、乐观更新 |
| [04-pwa-performance.md](04-pwa-performance.md) | PWA 性能：PRPL 模式、预缓存、按需加载、更新策略 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/sw-manager.md](mini-impl/sw-manager.md) | 手写 SW 生命周期管理器 |
| [mini-impl/offline-store.md](mini-impl/offline-store.md) | 手写离线存储管理器 |

## PWA 决策树

```
需要离线功能？
  ├─ 完全离线 → App Shell + Cache First + Background Sync
  ├─ 弱网优化 → Stale While Revalidate + 离线页面
  └─ 仅在线 → 不需要 SW

数据同步需求？
  ├─ 实时同步 → Background Sync + 队列
  ├─ 可延迟同步 → 下次联网时批量同步
  └─ 无需同步 → 纯缓存即可

推送通知？
  ├─ 是 → Push API + Notification API
  └─ 否 → 忽略
```
