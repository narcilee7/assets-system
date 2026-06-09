# SSR 工程化

服务端渲染工程化训练 —— 达到"能设计渲染架构、能优化 Hydration、能部署边缘渲染"的水平。

## 训练哲学

1. **首字节时间决定生死**：用户不会等待超过 3 秒，SSR 的 TTFB 必须可控。
2. **Hydration 是性能陷阱**：服务端输出了 HTML，客户端又重做一次，这个重复必须被消除或优化。
3. **流式是未来的默认**：Suspense + Streaming SSR 让页面渐进式呈现，而不是等全部就绪。
4. **边缘计算改变架构**：CDN Edge Workers 让 SSR 从数据中心跑到用户门口。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-rendering-models.md](01-rendering-models.md) | 渲染模型全景：CSR/SSR/SSG/ISR/Streaming/Edge 对比与选型 |
| [02-hydration.md](02-hydration.md) | Hydration 原理与优化：选择性注水、渐进式注水、Resumable、 Islands Architecture |
| [03-streaming-ssr.md](03-streaming-ssr.md) | 流式 SSR：Suspense、Progressive Rendering、Shell 模式、Out-of-Order Streaming |
| [04-edge-rendering.md](04-edge-rendering.md) | 边缘渲染：Vercel Edge、Cloudflare Workers、Deno Deploy、边缘缓存策略 |
| [05-ssr-state-management.md](05-ssr-state-management.md) | SSR 状态管理：脱水/注水（Dehydrate/Rehydrate）、Universal Store、请求隔离 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/streaming-renderer.md](mini-impl/streaming-renderer.md) | 手写流式 SSR 渲染器（Suspense + 流式传输） |
| [mini-impl/hydration-optimizer.md](mini-impl/hydration-optimizer.md) | 手写 Hydration 优化器（选择性注水 + Islands） |

## 渲染模型决策树

```
内容更新频率？
  ├─ 几乎不变（博客/文档）→ SSG + CDN
  ├─ 频繁变化（电商/新闻）→ SSR / ISR
  └─ 实时数据（Dashboard）→ CSR + API

SEO 要求？
  ├─ 高（公开内容） → SSR/SSG 必选
  └─ 低（后台系统） → CSR 即可

交互复杂度？
  ├─ 高（富应用） → SSR + 选择性 Hydration
  └─ 低（内容站） → SSG + 最小 Hydration

延迟要求？
  ├─ 极致（全球用户）→ Edge SSR + 流式
  ├─ 低（区域用户） → 传统 SSR + 缓存
  └─ 一般 → SSG + ISR
```
