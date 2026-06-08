# HTML 工程化基础

## 1. 语义化标签

```html
<!-- 文档结构 -->
<!DOCTYPE html>
<html lang="zh-CN" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面标题 - 网站名称</title>
  <meta name="description" content="页面描述，150字以内">
  <link rel="canonical" href="https://example.com/page">
</head>
<body>
  <header>
    <nav aria-label="主导航">
      <a href="/" aria-current="page">首页</a>
      <a href="/about">关于</a>
    </nav>
  </header>

  <main>
    <article>
      <header>
        <h1>文章标题</h1>
        <time datetime="2024-06-01">2024年6月1日</time>
      </header>

      <section aria-labelledby="section-1">
        <h2 id="section-1">第一节</h2>
        <p>内容...</p>
        <figure>
          <img src="chart.png" alt="2024年Q2销售数据图表" loading="lazy">
          <figcaption>图 1：2024年Q2销售趋势</figcaption>
        </figure>
      </section>
    </article>

    <aside aria-label="相关内容">
      <h2>推荐文章</h2>
      <!-- ... -->
    </aside>
  </main>

  <footer>
    <p>&copy; 2024 公司名称</p>
  </footer>
</body>
</html>
```

| 标签 | 用途 | 避免 |
|------|------|------|
| `<header>` | 页面/区域页眉 | 不要嵌套在 `<footer>` 或 `<address>` 中 |
| `<nav>` | 主要导航链接组 | 不是所有链接组都需要 nav |
| `<main>` | 页面主要内容（唯一） | 每页只能有一个 |
| `<article>` | 独立完整的内容块 | 不要用于布局容器 |
| `<section>` | 主题性内容分组 | 需要标题（h2-h6） |
| `<aside>` | 侧边栏/相关内容 | 不是视觉上的"旁边" |
| `<figure>`/`<figcaption>` | 图文组合 | figcaption 必须是第一个或最后一个子元素 |
| `<time>` | 时间/日期 | 使用 datetime 属性 |
| `<mark>` | 高亮标记 | 不是背景色 |
| `<details>`/`<summary>` | 可折叠内容 | 无需 JS 的手风琴 |

## 2. 可访问性（A11y）

```html
<!-- 图像可访问性 -->
<img src="photo.jpg" alt="描述图像内容，而非"图像"">  <!-- 有意义 -->
<img src="decoration.png" alt="">                      <!-- 装饰性：空 alt -->

<!-- 表单关联 -->
<label for="email">邮箱地址</label>
<input type="email" id="email" name="email" 
       required 
       aria-describedby="email-hint"
       aria-invalid="false">
<p id="email-hint" class="hint">我们将不会公开您的邮箱</p>
<p id="email-error" class="error" role="alert" hidden>请输入有效的邮箱地址</p>

<!-- 按钮状态 -->
<button aria-pressed="false" aria-expanded="false">
  展开详情
</button>

<!-- 实时区域 -->
<div role="status" aria-live="polite">
  已保存 3 项更改
</div>

<div role="alert" aria-live="assertive">
  错误：无法连接到服务器
</div>

<!-- 跳过链接 -->
<a href="#main" class="skip-link">跳转到主要内容</a>
<main id="main" tabindex="-1">
```

```css
/* 跳过链接 */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px 16px;
  z-index: 100;
}
.skip-link:focus {
  top: 0;
}

/* 焦点可见 */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* 高对比度模式 */
@media (prefers-contrast: more) {
  .button {
    border: 2px solid currentColor;
  }
}
```

## 3. SEO 基础

```html
<head>
  <!-- 基础 -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面标题 | 网站名称</title>
  <meta name="description" content="页面描述，控制在150-160字符">

  <!-- 规范化 -->
  <link rel="canonical" href="https://example.com/page">

  <!-- Open Graph -->
  <meta property="og:title" content="页面标题">
  <meta property="og:description" content="页面描述">
  <meta property="og:image" content="https://example.com/og-image.jpg">
  <meta property="og:url" content="https://example.com/page">
  <meta property="og:type" content="article">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@site">
  <meta name="twitter:creator" content="@author">

  <!-- 多语言 -->
  <link rel="alternate" hreflang="zh-CN" href="https://example.com/zh/page">
  <link rel="alternate" hreflang="en" href="https://example.com/en/page">

  <!-- 预加载 -->
  <link rel="preconnect" href="https://cdn.example.com">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

  <!-- 结构化数据 -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "文章标题",
    "author": {
      "@type": "Person",
      "name": "作者名"
    },
    "datePublished": "2024-06-01",
    "publisher": {
      "@type": "Organization",
      "name": "公司名称",
      "logo": {
        "@type": "ImageObject",
        "url": "https://example.com/logo.png"
      }
    }
  }
  </script>
</head>
```

## 4. 结构化数据

```html
<!-- BreadcrumbList -->
<nav aria-label="面包屑">
  <ol itemscope itemtype="https://schema.org/BreadcrumbList">
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <a itemprop="item" href="/">
        <span itemprop="name">首页</span>
      </a>
      <meta itemprop="position" content="1">
    </li>
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <a itemprop="item" href="/category">
        <span itemprop="name">分类</span>
      </a>
      <meta itemprop="position" content="2">
    </li>
  </ol>
</nav>

<!-- FAQPage -->
<div itemscope itemtype="https://schema.org/FAQPage">
  <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <summary itemprop="name">常见问题 1？</summary>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">答案内容...</p>
    </div>
  </details>
</div>
```
