# SEO & GEO

SEO（Search Engine Optimization）与 GEO（Generative Engine Optimization）训练 —— 达到"能构建技术 SEO 架构、能优化 AI 搜索可见性"的水平。

## 训练哲学

1. **SEO 是工程问题**：爬虫可读性、渲染速度、结构化数据，都是技术实现决定的。
2. **GEO 是内容问题 + 结构问题**：AI 引擎不"排名"页面，而是"引用"内容。你的内容需要被 AI 容易理解和信任。
3. **技术栈决定天花板**：SSR/SSG/预渲染的选择直接影响 SEO 效果。

## 体系索引

### 传统技术 SEO
| 文档 | 内容 |
|------|------|
| [01-technical-seo.md](01-technical-seo.md) | 技术 SEO：SSR/SSG/预渲染、Core Web Vitals、robots/sitemap、URL 规范 |
| [02-content-optimization.md](02-content-optimization.md) | 内容优化：EEAT、结构化内容、Schema.org、FAQ/HowTo、实体优化 |

### 生成式引擎优化（GEO）
| 文档 | 内容 |
|------|------|
| [03-geo-fundamentals.md](03-geo-fundamentals.md) | GEO 基础：AI 搜索工作原理、GEO vs SEO、引用策略 |
| [04-ai-search-visibility.md](04-ai-search-visibility.md) | AI 搜索可见性：Perplexity/ChatGPT/Google AI Overviews/DeepSeek 优化策略 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/structured-data.md](mini-impl/structured-data.md) | 手写结构化数据生成器（Schema.org JSON-LD） |
| [mini-impl/seo-audit-cli.md](mini-impl/seo-audit-cli.md) | 手写 SEO 审计 CLI（爬虫模拟 + 性能检测 + Schema 验证） |

## SEO/GEO 决策树

```
内容类型？
  ├─ 营销页面 / 博客 → SSG（Next.js/Nuxt 静态生成）
  ├─ 电商 / 动态内容 → SSR（服务端渲染）
  ├─ 应用 / Dashboard → CSR + 预渲染关键页面
  └─ 文档 / API → SSG + 结构化数据

AI 搜索优化？
  ├─ 引用可见性 → 结构化内容 + 权威来源引用
  ├─ 答案准确性 → FAQ/HowTo Schema + 明确的事实陈述
  └─ 品牌提及 → 知识图谱 + Wikipedia + 权威媒体

技术栈选择？
  ├─ Next.js App Router → React Server Components + 流式 SSR
  ├─ Nuxt 3 → 混合渲染（SSG/SSR/ISR）
  ├─ Astro → 零 JS 静态站点（SEO 最优）
  └─ 传统 CSR → 预渲染服务（Prerender.io/Puppeteer）
```
