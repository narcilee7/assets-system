# Rendering Strategies（渲染策略决策树）

## 问题描述

理解 Next.js 中五种渲染策略的核心差异、适用场景和性能特点，能够根据业务需求选择正确的策略。

## 五种渲染策略

| 策略 | 缩写 | 渲染时机 | 数据获取 | 适用场景 |
|------|------|----------|----------|----------|
| Static Site Generation | SSG | Build 时 | build time | 静态内容、博客、文档 |
| Incremental Static Regeneration | ISR | Build + 请求时 | build time + revalidate | 频繁更新但不实时要求的内容 |
| Server-Side Rendering | SSR | 请求时 | request time | 实时性要求高的个性化内容 |
| Client-Side Rendering | CSR | 浏览器 | client | 完全个性化的交互组件 |
| React Server Components | RSC | 服务器流式 | request time | 混合：服务端数据 + 客户端交互 |

## 核心对比维度

1. **Time to First Byte (TTFB)**：SSR 快还是 SSG 快？
2. **Time to Interactive (TTI)**：hydration 成本谁更高？
3. **Data Freshness**：多久需要刷新数据？
4. **SEO**：哪些策略对爬虫友好？
5. **User-specific**：是否需要个性化内容？

## 练习题

### 题目 1：选择正确的策略

为以下场景选择最合适的渲染策略，并说明理由：

```
A. 电商产品详情页（库存实时更新）
B. 博客文章列表
C. 用户个人资料页
D. 搜索结果页
E. 营销落地页（一年改一次）
F. 实时股价展示
G. 带个性化推荐的首页
H. 文档网站
```

### 题目 2：混合策略设计

设计一个电商详情页的渲染策略：
- 顶部 Banner（运营编辑，小时级更新）
- 商品基础信息（SPU 数据，天级更新）
- 实时库存（秒级更新）
- 个性化推荐（用户相关）
- 评论列表（高交互）

### 题目 3：性能对比

计算以下场景的总加载时间：

```
假设：
- 网络延迟：100ms
- 数据获取：200ms
- 页面 HTML 生成：50ms
- JS bundle 下载执行：500ms
- 浏览器渲染：100ms

场景 A：纯 CSR
场景 B：SSR + Hydration
场景 C：SSG + CSR（API 获取实时数据）
场景 D：RSC（server component 直接获取数据）
```

## 验证方式

```bash
make run   # 查看渲染策略对比
make test  # 运行选择题
```

## 追问

- SSG 的 build time 太长怎么办？（code splitting、增量构建）
- ISR 的 revalidate=0 是什么意思？和 SSR 有何区别？
- RSC 的 "streaming" 机制和 ISR 有什么关系？
- 如何用 Next.js 的 `cache` 函数模拟 SWR？