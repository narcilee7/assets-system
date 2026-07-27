# Next.js Architecture


## 一、Next.js 作为全栈框架

### 1.1 架构定位：不是"React + API 路由"

很多人把 Next.js 理解为 **React + Express 的缝合体**，这是错的。Next.js 的核心架构设计是 **以渲染为中心的全栈运行时**，而非传统 MVC 后端框架。

```
传统全栈框架（Rails/NestJS）:
  Router → Controller → Service → Model → View(前端框架)

Next.js 架构:
  Router(file-based) → Render Engine → React Tree → (RSC Payload | HTML+JS)
                              ↓
                        Data Layer(fetch/cache)
                              ↓
                        API Routes / Server Actions (optional)
```

关键区别：Next.js 的"后端能力"（API Routes、Server Actions）是 **渲染管道的延伸**，而非独立的服务层。数据获取发生在渲染阶段，而不是渲染前。

### 1.2 App Router 的架构革命

Pages Router 时代，Next.js 本质上是 **路由分发器**：
- 匹配路由 → 决定 SSR/SSG/CSR → 调用 `getServerSideProps` / `getStaticProps` → 注入 props → 渲染 React 组件

App Router 时代，架构变成了 **以 RSC 为核心的流式渲染管道**：

```
请求 → Route Matcher → React Server Components (RSC) 
                              ↓
                    生成 RSC Payload (React 自定义序列化格式)
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
        纯 RSC 路由                    含 Client Component
              ↓                               ↓
         直接返回 HTML                  RSC Payload + HTML
                                        + Client JS chunks
                                              ↓
                                    浏览器：React 流式解析 + Hydration
```

**核心变化**：Server Components 不是"在服务端运行的组件"，而是 **不生成客户端 JS 的组件**。它们直接输出 HTML 或 RSC Payload，不存在 hydration 开销。

### 1.3 全栈能力的边界

| 能力 | Next.js 实现 | 传统后端对比 |
|------|-------------|-------------|
| **路由** | File-based + Route Groups + Parallel Routes | 声明式/注解式路由 |
| **数据获取** | `fetch` + `cache` + `unstable_cache` | ORM + Service Layer |
| **状态管理** | URL State / Server State (Server Actions) | Session / Redis / DB |
| **API 层** | Route Handlers / Server Actions | REST / GraphQL / gRPC |
| **中间件** | Middleware (Edge Runtime) | Express 中间件 / Gateway |
| **部署** | Vercel 优化 / Docker / Node.js | 任意 Node.js 主机 |

**Next.js 作为全栈框架的短板**：
- 无原生依赖注入，大型团队（20+ 人）架构边界易模糊
- 无内置 ORM/验证层，需自行引入 Prisma/Zod
- 文件路由在微服务场景下难以横向拆分
- Server Actions 的 RPC 语义是隐式的，API 契约不如 REST/GraphQL 清晰

### 1.4 运行时分层

Next.js 15 支持三种运行时：

| 运行时 | 执行环境 | 适用场景 |
|--------|---------|---------|
| **Node.js** | 完整 Node API | 数据库操作、文件系统、重计算 |
| **Edge** | V8 isolates (轻量) | Middleware、简单重写、A/B 测试 |
| **Serverless** | 按需冷启动 | API Routes、Server Actions |

**关键认知**：App Router 默认在 Node.js 运行时渲染 RSC，但 Middleware 强制在 Edge Runtime 执行。混合运行时增加了心智负担——同一份代码在 Middleware 里不能访问 `fs`，在 API Route 里可以。

---

## 二、Next.js 所有渲染类型全景

Next.js 的渲染策略经历了三代演进：

```
Pages Router:        SSR / SSG / ISR / CSR
App Router (v13+):   Static / Dynamic / Streaming
App Router (v15+):   PPR + "use cache" + Cache Components
```

### 2.1 CSR（Client-Side Rendering）

**原理**：服务端只返回空 HTML shell（或极小的骨架屏），所有内容在浏览器通过 JS 执行后渲染。

**触发条件**：
- Pages Router：不使用 `getServerSideProps` / `getStaticProps`，组件内部用 `useEffect` 获取数据
- App Router：组件顶部标记 `"use client"` + 客户端数据获取

**输出产物**：
```
HTML: <div id="__next"></div>
JS:   React bundle + 业务代码 + 数据获取逻辑
```

**适用场景**：后台管理系统、重度交互应用（图表编辑器）、无需 SEO 的登录态页面。

**性能特征**：TTFB 低（只传 shell），但 FCP/LCP 高（需下载+解析 JS + 请求数据）。

### 2.2 SSR（Server-Side Rendering）

**原理**：每次请求在服务端完整执行 React 渲染，生成完整 HTML 返回。

**触发条件**：
- Pages Router：`getServerSideProps` 或 `export const dynamic = "force-dynamic"`（App Router）
- App Router：页面包含动态数据（如 `cookies()` / `headers()` / 未缓存的 `fetch`）

**输出产物**：
```
HTML: 完整渲染后的 HTML（含数据）
JS:   React bundle（用于 Hydration）
```

**关键细节**：SSR 的 HTML 是"可交互前的快照"。浏览器仍需下载 JS、执行 Hydration，才能让页面真正可交互（按钮点击、状态更新）。

**性能特征**：TTFB 高（每次请求都渲染），但 FCP 快（HTML 直接可展示）。

### 2.3 SSG（Static Site Generation）

**原理**：构建时预渲染 HTML，部署后 CDN 直接返回静态文件。

**触发条件**：
- Pages Router：`getStaticProps`
- App Router：无动态依赖（不读取 cookie/header，使用静态 `fetch` 或默认缓存）

**输出产物**：
```
HTML: 构建时生成的静态文件
JS:   按需加载的 Client Component chunks
```

**缓存行为**：CDN 缓存，TTL 由 CDN 配置决定，Next.js 本身不自动刷新。

**适用场景**：营销页、文档、博客、商品详情页（不常变部分）。

### 2.4 ISR（Incremental Static Regeneration）

**原理**：SSG + 后台定时刷新。首次访问返回缓存版本，同时触发后台重新渲染。

**触发条件**：
```tsx
// 时间驱动
export const revalidate = 3600; // 秒

// 事件驱动（按需）
revalidatePath('/path');
revalidateTag('collection');
```

**缓存行为**：
```
第 1 个用户：返回 stale HTML（立即）→ 触发后台 re-render
第 2 个用户：返回 fresh HTML（如果 re-render 完成）
```

**关键陷阱**：ISR 的"stale-while-revalidate"意味着第一个用户可能看到旧数据，且 Next.js 不提供"正在重新渲染中"的状态反馈。

### 2.5 Streaming SSR（流式服务端渲染）

**原理**：React 18 引入的 Suspense 流式渲染。服务端不等待所有数据就绪，先发送 HTML 骨架，数据就绪后通过流推送后续内容。

**触发条件**：
- App Router 默认支持
- 组件树中存在 `<Suspense>` 边界

**输出格式**：
```html
<!-- 初始 chunk -->
<div>
  <nav>...</nav>
  <main>
    <div id="S:1">Loading...</div>  <!-- Suspense fallback -->
  </main>
</div>

<!-- 后续 stream chunk -->
<div hidden id="S:1">
  <!-- 真实内容 -->
</div>
<script>
  // React 将 stream 内容替换到对应位置
</script>
```

**性能优势**：TTFB 与 FCP 解耦。用户立即看到页面结构，动态内容逐步填充。

### 2.6 RSC（React Server Components）

**原理**：只在服务端运行的组件，不生成客户端 JS，直接输出 HTML 或 RSC Payload。

**关键特征**：
- 可以直接访问服务端资源（DB、文件系统、私有 API）
- 不能包含客户端交互（`useState`、`onClick` 等）
- 不参与 hydration，首屏即最终形态

**RSC Payload**：
RSC 不是输出纯 HTML，而是 React 自定义的序列化格式：
```
M1:{"id":"./Component.tsx","chunks":["pae","dynamic"],"name":"default"}
J0:["$","div",null,{"className":"container","children":[...]}]
```
浏览器接收后，React 解析此 Payload 构建组件树，再与 Client Components 合并。

### 2.7 PPR（Partial Prerendering）

**原理**：同一页面混合静态和动态内容。静态部分预渲染为 CDN 缓存的 shell，动态部分通过 Suspense 流式注入。

**触发条件**（Next.js 15+）：
```tsx
export const experimental_ppr = true; // v15
// 或 next.config.js: experimental.ppr = true
```

**工作机制**：
```
构建时：
  - 静态部分（无动态依赖的组件）→ 预渲染为 HTML shell
  - 动态部分（含 `cookies()` / 未缓存 `fetch`）→ 标记为 dynamic hole

请求时：
  - CDN 立即返回静态 shell（~50ms）
  - 服务端并行渲染 dynamic holes
  - 通过 HTTP streaming 推送动态内容
```

**与 ISR 的关系**：PPR 的静态 shell 底层依赖 ISR 机制管理。你可以对 shell 使用 `revalidate` 或 `revalidateTag`。

### 2.8 Cache Components / `"use cache"`（Next.js 15+）

**原理**：函数级缓存，比 ISR 更细粒度。

```tsx
async function FeaturedProducts() {
  "use cache"; // 函数结果缓存
  cacheLife("hours"); // 缓存 1 小时
  cacheTag("products"); // 可 tag 化失效
  
  const products = await fetch('/api/featured');
  return <ProductList data={products} />;
}
```

**与 PPR 的区别**：
| 特性 | PPR | `"use cache"` |
|------|-----|---------------|
| 缓存单位 | 页面级 shell | 函数/组件级 |
| 失效方式 | `revalidatePath` | `cacheTag` + `revalidateTag` |
| 动态部分 | Suspense holes | 不缓存的函数 |
| 粒度 | 粗 | 细 |

---

## 三、渲染策略决策矩阵

```
页面是否依赖用户态（cookie/header）？
  ├─ 否 → 内容是否经常变化？
  │        ├─ 否 → SSG（构建一次，永久缓存）
  │        └─ 是 → ISR（定时刷新）或 "use cache"（函数级缓存）
  └─ 是 → 是否有大量静态内容？
           ├─ 是 → PPR（静态 shell + 动态 holes）
           └─ 否 → SSR（全动态）或 Streaming SSR
```

### 实际场景的混合策略

**电商商品页**：
- 商品图片/描述/规格 → SSG / `"use cache"`
- 实时库存/个性化价格 → Suspense + SSR streaming
- 用户购物车 → Client Component (CSR)

**SaaS Dashboard**：
- 导航/布局 → PPR 静态 shell
- 用户数据图表 → RSC + Streaming
- 实时通知 → CSR (WebSocket)

---

## 四、面试常问的底层问题

1. **RSC 和 SSR 的区别？**
   - SSR 输出 HTML，仍需 hydration；RSC 输出 RSC Payload，不 hydration。
   - SSR 是"渲染时机"的概念，RSC 是"组件类型"的概念。二者可以共存：RSC 在 SSR 过程中运行。

2. **PPR 和 ISR 能一起用吗？**
   - PPR 的静态 shell 底层就是 ISR。`revalidate` 对 PPR shell 同样生效。

3. **Server Actions 是 RPC 吗？**
   - 是，但它是 React 的隐式 RPC。编译器把 `async function` 转成 API endpoint，前端调用时序列化参数，通过 `POST` 请求执行。

4. **为什么 App Router 的 `fetch` 默认缓存？**
   - Next.js 覆写了全局 `fetch`，默认 `cache: 'force-cache'`。这是为了将 React 的渲染模型与 HTTP 缓存语义对齐——RSC 渲染是可复用的计算，应该被缓存。

5. **Edge Runtime 能跑 RSC 吗？**
   - 能，但受限。Edge Runtime 是 V8 isolates，无 Node.js API。RSC 本身不依赖 Node，但如果 RSC 内部访问数据库（需 TCP），则必须在 Node.js 运行时。
