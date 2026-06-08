# 前端缓存策略

前端缓存策略训练 —— 达到"能设计缓存架构、能处理缓存失效、能优化加载性能"的水平。

## 训练哲学

1. **缓存是性能的核心杠杆**：合理的缓存策略能让首屏时间降低 80% 以上。
2. **缓存失效是计算机科学两大难题之一**：必须有明确的失效策略，否则缓存就是隐患。
3. **分层缓存**：浏览器 HTTP Cache → Service Worker → Memory Cache → CDN Cache，每层都有适用场景。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-http-cache.md](01-http-cache.md) | HTTP Cache：Cache-Control、ETag、Last-Modified、CDN 缓存策略 |
| [02-service-worker.md](02-service-worker.md) | Service Worker：生命周期、缓存策略（Cache First / Network First / Stale While Revalidate） |
| [03-cache-api.md](03-cache-api.md) | Cache API 与离线存储：Cache Storage、IndexedDB、离线优先架构 |
| [04-cache-invalidation.md](04-cache-invalidation.md) | 缓存失效策略：文件名哈希、版本控制、CDN 刷新、优雅降级 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/sw-cache.md](mini-impl/sw-cache.md) | 手写 Service Worker 缓存管理器 |
| [mini-impl/http-cache-middleware.md](mini-impl/http-cache-middleware.md) | 手写 HTTP 缓存中间件 |

## 缓存决策树

```
资源类型？
  ├─ HTML（入口） → no-cache（总是验证）
  ├─ JS/CSS（构建产物） → immutable + 文件名哈希 → 永久缓存
  ├─ 图片/字体 → max-age=31536000 + 文件名哈希
  ├─ API 响应 → private, max-age=60（视业务而定）
  └─ 用户数据 → no-store

是否支持离线？
  ├─ 是 → Service Worker + Cache API
  │   ├─ 关键资源 → Cache First
  │   ├─ 数据 API → Stale While Revalidate
  │   └─ 实时数据 → Network First
  └─ 否 → HTTP Cache + CDN 即可

缓存失效？
  ├─ 文件名哈希变更 → 自动失效（推荐）
  ├─ 查询参数版本号 → ?v=2 → 需 CDN 刷新
  └─ 手动清理 → Service Worker skipWaiting + clients.claim
```
