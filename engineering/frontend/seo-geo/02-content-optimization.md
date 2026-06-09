# 内容优化

## 1. EEAT 原则

Google 质量评分核心标准，GEO 同样适用：

| 维度 | 含义 | 优化手段 |
|------|------|---------|
| **Experience**（经验） | 作者是否有第一手经验 | 作者简介、案例研究、实操步骤 |
| **Expertise**（专业） | 内容是否展示专业知识 | 深度分析、数据引用、技术细节 |
| **Authoritativeness**（权威） | 网站/作者是否被认可 | 外部引用、媒体报道、行业认证 |
| **Trustworthiness**（可信） | 内容是否准确可靠 | 引用来源、更新日期、事实核查 |

```html
<!-- 作者信息（Schema.org） -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "author": {
    "@type": "Person",
    "name": "张伟",
    "jobTitle": "高级前端工程师",
    "worksFor": { "@type": "Organization", "name": "TechCorp" },
    "url": "https://example.com/authors/zhangwei",
    "image": "https://example.com/authors/zhangwei.jpg"
  }
}
</script>
```

## 2. 结构化内容

AI 引擎（和爬虫）偏好结构清晰的内容：

```markdown
## 不好的结构（AI 难以提取）

React 性能优化有很多方法。比如你可以用 memo，还有 useMemo 也可以。
懒加载也不错。代码分割很重要。你应该注意 bundle size。

## 好的结构（AI 容易引用）

# React 性能优化完全指南

## 1. 组件渲染优化
### 1.1 React.memo
- **用途**：防止不必要的重渲染
- **适用场景**：纯展示组件、Props 稳定的组件
- **示例**：
  ```jsx
  const MemoComponent = React.memo(({ data }) => {
    return <div>{data}</div>;
  });
  ```

### 1.2 useMemo / useCallback
- **用途**：缓存计算结果和函数引用
- **适用场景**：复杂计算、子组件 Props 传递
- **注意**：仅在性能瓶颈处使用，过度优化反而有害

## 2. 代码分割策略
| 策略 | 工具 | 适用场景 |
|------|------|---------|
| 路由级分割 | React.lazy + Suspense | 大型 SPA |
| 组件级分割 | dynamic import | 弹窗、图表等重型组件 |
| 库级分割 | Webpack splitChunks | 第三方库分离 |

## 3. Bundle Size 优化清单
- [ ] 使用 Tree Shaking 友好的库
- [ ] 按需加载组件库
- [ ] 压缩图片和字体
- [ ] 启用 Gzip/Brotli 压缩
```

## 3. Schema.org 结构化数据

```html
<!-- FAQPage Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "什么是 React.memo？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "React.memo 是一个高阶组件，用于缓存函数组件的渲染结果。当 Props 没有变化时，直接返回缓存的 JSX，避免不必要的重渲染。"
      }
    },
    {
      "@type": "Question",
      "name": "useMemo 和 useCallback 有什么区别？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "useMemo 缓存计算结果（值），useCallback 缓存函数引用。两者都依赖依赖数组来决定是否重新计算。"
      }
    }
  ]
}
</script>

<!-- HowTo Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "如何优化 React 应用性能",
  "step": [
    {
      "@type": "HowToStep",
      "name": "启用 React DevTools Profiler",
      "text": "安装 React DevTools 扩展，打开 Profiler 面板记录组件渲染时间。",
      "url": "https://example.com/guide#step1"
    },
    {
      "@type": "HowToStep",
      "name": "识别渲染瓶颈",
      "text": "查找渲染时间超过 16ms 的组件，这些是优化的重点。",
      "url": "https://example.com/guide#step2"
    }
  ]
}
</script>
```

## 4. 实体优化（Entity SEO）

```html
<!-- 知识图谱实体标记 -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "React Server Components 详解",
  "about": [
    {
      "@type": "Thing",
      "name": "React",
      "sameAs": "https://www.wikidata.org/wiki/Q378814"
    },
    {
      "@type": "Thing",
      "name": "Server Components",
      "sameAs": "https://react.dev/blog/2020/12/21/data-fetching-with-react-server-components"
    }
  ],
  "mentions": [
    { "@type": "Thing", "name": "Next.js", "sameAs": "https://www.wikidata.org/wiki/Q111510271" },
    { "@type": "Thing", "name": "Vercel", "sameAs": "https://www.wikidata.org/Q107983139" }
  ]
}
</script>
```

## 5. 内部链接策略

```markdown
## 上下文链接（AI 更容易理解页面关系）

在本文中，我们讨论了 React.memo 的基本用法。如果你需要更深入的优化策略，
可以阅读 [React 性能优化完全指南](/blog/react-performance-guide)，
其中详细介绍了 useMemo、useCallback 和代码分割策略。

对于 Next.js 用户，[App Router 数据获取模式](/blog/nextjs-data-fetching)
提供了 Server Components 和 Streaming SSR 的最佳实践。

## 避免的做法
- 底部堆砌"相关文章"链接列表
- 使用"点击这里"作为锚文本
- 同一页面出现大量重复锚文本
```
