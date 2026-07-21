# Nuxt.js Training

---

# Part 1. 为什么会有 Nuxt？

不要直接讲 Nuxt。

先讲 Vue 生态。

```
Vue
   │
   ├── SPA
   │
   ├── SSR
   │
   ├── SSG
   │
   ├── ISR
   │
   └── Edge Rendering
```

为什么 Vue Router + Vite 不够？

例如：

淘宝首页

```
SEO
首屏
缓存
Streaming
API Proxy
```

全部自己写？

于是出现

```
Nuxt
```

它就是

> Vue Fullstack Framework。

---

# Part 2 Rendering Evolution

这一部分最重要。

画时间线。

```
CSR

↓

SSR

↓

SSG

↓

ISR

↓

Streaming SSR

↓

Partial Hydration

↓

Island

↓

Edge Rendering
```

然后一个一个分析。

例如：

CSR

```
Browser

↓

Download JS

↓

Hydrate

↓

Fetch API

↓

Paint
```

SSR

```
Browser

↓

Node

↓

Render HTML

↓

Browser

↓

Hydrate
```

SSG

```
Build Time

↓

Generate HTML

↓

CDN

↓

Browser
```

ISR

```
第一次请求

↓

生成 HTML

↓

缓存

↓

TTL

↓

重新生成
```

---

# Part 3 Nuxt Rendering Matrix

Nuxt 真正厉害的是：

不是一个 Render。

而是

```
Universal

SPA

SSR

SSG

ISR

CSR

Hybrid
```

最后还能：

```
Route Rules

/pageA

SSR

/pageB

SSG

/pageC

ISR

/pageD

SPA
```

一个项目

不同页面

不同 Render。

这是 Next 后来才统一好的。

---

# Part 4 Nitro

这是很多人不会讲的。

Nuxt3 最大升级不是 Vue3。

而是：

```
Nitro
```

为什么？

以前：

```
Vue

↓

Express

↓

Node
```

现在：

```
Vue

↓

Nitro

↓

Node

Deno

Cloudflare

Vercel

Bun
```

Nitro 抽象了 Runtime。

所以：

```
Server API

Storage

Cache

Preset

Deployment
```

全部统一。

---

# Part 5 Route Rules

这是 Nuxt 最有意思的地方。

例如：

```ts
routeRules: {

 "/": {

    prerender:true

 },

 "/blog/**":{

    swr:60

 },

 "/dashboard/**":{

    ssr:false

 }

}
```

实际上：

```
首页

↓

SSG

博客

↓

ISR

后台

↓

SPA
```

全部共存。

这就是 Hybrid Rendering。

---

# Part 6 Server API

Nuxt：

```
server/

api/

hello.ts
```

其实就是：

```
Nitro Server
```

不是 Express。

不是 Koa。

甚至不是 Node。

而是：

```
H3
```

生命周期：

```
Request

↓

Event

↓

Handler

↓

Response
```

里面：

```
getQuery()

readBody()

send()

setCookie()

```

都是 H3。

---

# Part 7 Data Fetch

Nuxt 有三套。

```
$fetch

↓

useFetch

↓

useAsyncData
```

什么时候用？

很多人不知道。

实际上：

### $fetch

普通 HTTP Client

```
Client

↓

API
```

---

### useFetch

SSR + Client

```
SSR

↓

Serialize

↓

Hydrate

↓

Client
```

自动避免重复请求。

---

### useAsyncData

任何异步。

例如：

```
Promise.all

Redis

GraphQL

Prisma

Filesystem
```

不是只能 Fetch。

---

# Part 8 Payload

Nuxt 一个很大的优化。

```
SSR

↓

HTML

+

payload.js
```

Hydrate 时：

不用重新请求。

直接：

```
window.__NUXT__
```

恢复状态。

这个很多人没研究。

---

# Part 9 Cache

Nitro Cache。

例如：

```
cachedFunction()

cachedEventHandler()
```

底层：

```
Memory

Redis

KV

Cloudflare Cache
```

统一接口。

---

# Part 10 Streaming SSR

Vue3：

```
renderToNodeStream()

↓

Chunk

↓

Browser

↓

Hydrate
```

Nuxt：

直接支持。

对于：

```
Slow API

↓

Fast Header

↓

Fast Shell

↓

Late Content
```

用户体验提升很多。

---

# Part 11 Lazy Hydration

Nuxt：

```
<ClientOnly>

<Lazy>

defineLazyHydrationComponent()
```

什么时候 Hydrate？

```
Visible

Idle

Interaction

Media Query
```

都可以。

---

# Part 12 SEO

Nuxt：

```
useSeoMeta()

useHead()

useServerSeoMeta()
```

底层：

```
Unhead
```

自动：

```
Title

Description

OpenGraph

Twitter

Canonical
```

---

# Part 13 Image Optimization

Nuxt Image

```
<Image>

↓

IPX

↓

Resize

↓

WebP

↓

AVIF

↓

CDN
```

---

# Part 14 实战优化（最值得讲）

这一部分建议完全用 Case Study，而不是 API 罗列。

**Case 1：企业官网（SEO 优先）**

* 首页、产品页：SSG + CDN
* 新闻页：SWR/ISR（60~300 秒）
* 联系我们：SSR（如需实时表单状态）
* 图片：Nuxt Image + AVIF/WebP
* Head：`useSeoMeta`

**Case 2：内容社区**

* 首页 Feed：SSR（保证首屏）
* 文章详情：ISR/SWR（高缓存命中）
* 用户主页：SSR（个性化）
* 编辑器：SPA（关闭 SSR）
* 评论：客户端懒加载 + Lazy Hydration

**Case 3：后台管理系统**

* 全站 `ssr: false`
* Vite SPA
* API 走 Nitro Proxy 或直接后端
* 路由级代码分割

**Case 4：AI Chat（你现在方向非常相关）**

* Chat 页面：SPA（避免 Hydration 成本和复杂状态同步）
* Landing Page：SSG（SEO）
* Pricing：SSG
* Docs：ISR/SWR
* 登录页：SSR
* `/api/chat`：Nitro + SSE/Streaming Response
* 模型配置与 Prompt：服务端运行，避免暴露到客户端

---

如果这是一个完整的复盘系列，我会把它压缩成四个核心主题，形成由浅入深的学习路径：

1. **Rendering 原理**：CSR、SSR、SSG、ISR、Streaming、Hybrid，它们解决什么问题，各自的性能与 SEO 权衡。
2. **Nuxt Runtime**：Nitro、H3、Server API、Route Rules、Payload、Data Fetch，这些能力如何协同工作。
3. **性能优化**：Hydration、Lazy Hydration、缓存、Streaming、图片优化、资源加载策略。
4. **生产实践**：不同业务（官网、博客、SaaS、AI Chat、后台管理）的渲染模式选择，以及部署到 Node、Edge、Serverless 等不同运行环境时的架构设计。

这样的 Topic 既覆盖 Nuxt 的核心能力，又能体现对现代 Web Rendering 架构的系统理解，而不仅仅停留在框架 API 层面。
