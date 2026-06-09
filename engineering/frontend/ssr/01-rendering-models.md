# 渲染模型全景

## 1. 六种渲染模型对比

| 模型 | 首屏时间 | TTFB | 交互时间 | SEO | 服务器成本 | 复杂度 |
|------|---------|------|---------|-----|-----------|--------|
| **CSR** | 慢 | 快 | 慢 | 差 | 低 | 低 |
| **SSR** | 快 | 慢 | 中等 | 好 | 高 | 中 |
| **SSG** | 最快 | 最快 | 中等 | 好 | 极低 | 低 |
| **ISR** | 快 | 快 | 中等 | 好 | 低 | 中 |
| **Streaming SSR** | 渐进 | 快 | 中等 | 好 | 中 | 高 |
| **Edge SSR** | 快 | 极快 | 中等 | 好 | 低 | 高 |

```
CSR:     浏览器 → JS 下载 → 执行 → 渲染 → 可交互
         └────────────────────────────┘ 空白期

SSR:     浏览器 → HTML(完整) → 下载JS → Hydrate → 可交互
         └────────┘ 快速首屏    └────────────────┘ Hydration期

SSG:     CDN → HTML(预渲染) → 下载JS → Hydrate → 可交互
         └─────────┘ 最快首屏

ISR:     CDN(缓存) → HTML → 后台重建 → CDN更新
         └─────────┘ 快首屏 + 自动更新

Streaming: 浏览器 → HTML(shell) → 流式内容 → 下载JS → Hydrate
           └─────────┘ 最快FCP   └────────────────┘
```

## 2. 框架实现

```javascript
// Next.js App Router（混合渲染）
// 1. SSG - 默认
export default async function Page() {
  const data = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }  // ISR: 1小时后重新验证
  });
  return <PostList data={await data.json()} />;
}

// 2. SSR - 强制动态
export const dynamic = 'force-dynamic';

// 3. Streaming - Suspense
export default function Page() {
  return (
    <>
      <Header />                    {/* 立即渲染 */}
      <Suspense fallback={<Skeleton />}>
        <SlowContent />             {/* 流式加载 */}
      </Suspense>
    </>
  );
}

// Nuxt 3（混合渲染）
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },           // SSG
    '/blog/**': { isr: 60 },            // ISR: 60秒
    '/dashboard': { ssr: false },        // CSR
    '/api/**': { cors: true },           // API
  },
});

// Astro（默认 SSG，可选 SSR）
---
// 服务端代码（构建时或请求时执行）
const posts = await fetch('https://api.example.com/posts').then(r => r.json());
---
<!-- 零 JS 发送到客户端（除非添加 client:指令） -->
<PostList posts={posts} />

<!-- 仅交互组件发送 JS -->
<Search client:load />
<Comments client:visible />
```

## 3. 渲染模式选型矩阵

| 场景 | 推荐模式 | 理由 |
|------|---------|------|
| 营销落地页 | SSG | 内容固定，追求极致性能 |
| 博客/文档 | SSG + ISR | 内容为主，偶尔更新 |
| 电商商品页 | ISR | 价格/库存变化，需缓存 |
| 新闻站点 | SSR + CDN | 实时性强，更新频繁 |
| 用户 Dashboard | CSR | 强交互，SEO 不重要 |
| 社交 Feed | SSR + Streaming | 实时数据 + 渐进加载 |
| SaaS 首页 | SSG | SEO + 性能双重要求 |

## 4. 混合架构（BFF + 渲染层分离）

```
用户请求
  ↓
CDN Edge（Vercel Edge / Cloudflare）
  ├─ 命中缓存 → 直接返回 SSG 页面
  └─ 未命中/动态 → 回源到渲染层
                    ↓
              渲染服务器（Next.js / Nuxt）
                ├─ 静态内容 → 直接渲染
                └─ 动态数据 → 请求 BFF
                                ↓
                          BFF 层（聚合 API）
                            ├─ 用户服务
                            ├─ 商品服务
                            └─ 推荐服务
```
