# 技术 SEO

## 1. 渲染策略对比

| 策略 | 首次内容时间 | SEO 友好度 | 复杂度 | 适用场景 |
|------|-------------|-----------|--------|---------|
| **SSG**（静态生成） | 最快 | ⭐⭐⭐ | 低 | 博客、文档、营销页 |
| **SSR**（服务端渲染） | 快 | ⭐⭐⭐ | 中 | 电商、新闻、动态内容 |
| **ISR**（增量静态再生） | 快 | ⭐⭐⭐ | 中 | 大型站点、实时数据 |
| **CSR + 预渲染** | 慢（预渲染后快） | ⭐⭐ | 高 | SPA、Dashboard |
| **纯 CSR** | 慢 | ⭐ | 低 | 内部工具、Web App |

```javascript
// Next.js 渲染策略选择
// 1. SSG - 构建时生成
export async function generateStaticParams() {
  const posts = await fetchPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

// 2. SSR - 请求时渲染
export const dynamic = 'force-dynamic';

// 3. ISR - 按需重新生成
export const revalidate = 3600; // 1小时后重新生成

// 4. Streaming SSR - 渐进式渲染
export default async function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<Skeleton />}>
        <SlowContent />
      </Suspense>
    </>
  );
}
```

## 2. Core Web Vitals 与 SEO

Google 明确将 Core Web Vitals 作为排名信号：

| 指标 | 好 | 差 | 优化手段 |
|------|-----|-----|---------|
| LCP ≤2.5s | ≤4s | 图片优化、字体预加载、SSR |
| FID ≤100ms | ≤300ms | 代码分割、长任务拆分、Web Worker |
| CLS ≤0.1 | ≤0.25 | 图片尺寸声明、字体加载策略、动画优化 |
| INP ≤200ms | ≤500ms | 事件处理优化、主线程减负 |

```html
<!-- LCP 优化：图片预加载 -->
<link rel="preload" as="image" href="/hero.webp" type="image/webp">

<!-- 字体预加载（避免 FOIT/FOUT） -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

<!-- 关键 CSS 内联 -->
<style>
  /* 仅首屏关键样式 */
  .hero { ... }
  .nav { ... }
</style>
<link rel="stylesheet" href="/non-critical.css" media="print" onload="this.media='all'">
```

## 3. robots.txt / sitemap.xml

```txt
# robots.txt
User-agent: *
Allow: /

# 禁止爬虫访问
Disallow: /api/
Disallow: /admin/
Disallow: /cart/

# 爬虫限速（秒）
Crawl-delay: 1

# Sitemap 位置
Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-news.xml
```

```xml
<!-- sitemap.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/blog/hello-world</loc>
    <lastmod>2024-06-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/products/iphone-15</loc>
    <lastmod>2024-06-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <!-- 图片扩展 -->
    <image:image>
      <image:loc>https://example.com/images/iphone-15.webp</image:loc>
      <image:title>iPhone 15</image:title>
    </image:image>
  </url>
</urlset>
```

## 4. URL 规范化

```html
<!-- 1. 唯一 URL（避免重复内容） -->
<link rel="canonical" href="https://example.com/blog/hello-world">

<!-- 2. 分页规范化 -->
<link rel="canonical" href="https://example.com/products?page=1">
<link rel="prev" href="https://example.com/products?page=1">
<link rel="next" href="https://example.com/products?page=3">

<!-- 3. hreflang（多语言） -->
<link rel="alternate" hreflang="en" href="https://example.com/en/blog/hello">
<link rel="alternate" hreflang="zh-CN" href="https://example.com/zh/blog/hello">
<link rel="alternate" hreflang="x-default" href="https://example.com/blog/hello">

<!-- 4. 避免参数污染 -->
<!-- 不好：/blog/hello?utm_source=xxx -->
<!-- 好：使用 # 或 cookie 存储跟踪参数 -->
```

## 5. 元数据完整清单

```tsx
// Next.js 14 metadata API
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hello World - My Blog',
  description: 'A comprehensive guide to...',

  // Open Graph
  openGraph: {
    title: 'Hello World',
    description: '...',
    url: 'https://example.com/blog/hello-world',
    siteName: 'My Blog',
    images: [{
      url: 'https://example.com/og/hello-world.png',
      width: 1200,
      height: 630,
      alt: 'Hello World',
    }],
    locale: 'zh_CN',
    type: 'article',
    publishedTime: '2024-06-01T00:00:00Z',
    authors: ['https://example.com/authors/john'],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Hello World',
    description: '...',
    images: ['https://example.com/og/hello-world.png'],
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // 结构化数据（JSON-LD）
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Hello World',
      datePublished: '2024-06-01T00:00:00Z',
      author: { '@type': 'Person', name: 'John' },
    }),
  },
};
```
