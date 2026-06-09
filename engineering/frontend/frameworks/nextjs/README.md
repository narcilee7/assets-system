# Next.js Deep Dive

架构师级 Next.js 能力：能区分 SSR/SSG/ISR/RSC 的适用场景，理解 App Router 机制、缓存策略和 Streaming。

## 深度主题

| 主题 | 核心问题 | 资产 |
|------|----------|------|
| Rendering Strategies | SSR vs SSG vs ISR vs CSR vs RSC 何时用？ | [rendering-strategies](rendering-strategies/) |
| RSC (React Server Components) | client/server boundary 如何划分？序列化限制？ | [rsc](rsc/) |
| App Router | layout/page/loading/error 的组织方式？ | [app-router](app-router/) |
| Caching | fetch cache、route cache、full route cache 的层次？ | [caching](caching/) |
| Streaming | Suspense boundary 如何实现 partial rendering？ | [streaming](streaming/) |
| Server Action | 如何实现带 progressive enhancement 的 mutation？ | [server-action](server-action/) |

## P0 资产

| 资产 | 目录 | 状态 |
|------|------|------|
| Rendering strategies decision tree | `rendering-strategies/` | skeleton |
| RSC 原理 + boundary 序列化 | `rsc/` | skeleton |
| Next.js caching layers 解析 | `caching/` | skeleton |
| Streaming + Suspense 组合 | `streaming/` | skeleton |
| Server Action 简化实现 | `server-action/` | todo |

## 追问清单

- 哪些组件应该是 Server Component？原则是什么？
- 为什么 RSC 的 props 必须是可序列化的？
- fetch cache、route cache、full route cache 的失效策略有什么区别？
- Edge Runtime 和 Node.js Runtime 的本质区别是什么？
- Server Action 如何处理重定向和错误？
- ISR 的 revalidate 时机如何确定？