# 手写结构化数据生成器

## 目标

实现一个简化版 Schema.org JSON-LD 生成器，支持：
1. 常见 Schema 类型（Article、FAQPage、HowTo、Organization、BreadcrumbList）
2. 类型安全（TypeScript 风格接口）
3. 自动验证必填字段
4. 输出标准 JSON-LD script 标签

## 实现

```javascript
// structured-data.js

// Schema 类型定义（简化版）
const SchemaTypes = {
  Article: {
    required: ['@type', 'headline', 'author', 'datePublished'],
    optional: ['description', 'image', 'dateModified', 'publisher', 'articleBody'],
  },
  FAQPage: {
    required: ['@type', 'mainEntity'],
    optional: [],
  },
  HowTo: {
    required: ['@type', 'name', 'step'],
    optional: ['description', 'totalTime', 'supply', 'tool'],
  },
  Organization: {
    required: ['@type', 'name'],
    optional: ['url', 'logo', 'sameAs', 'description'],
  },
  BreadcrumbList: {
    required: ['@type', 'itemListElement'],
    optional: [],
  },
};

class StructuredData {
  constructor(options = {}) {
    this.baseContext = options.baseContext || 'https://schema.org';
  }

  // 生成 Article Schema
  article(data) {
    return this._build('Article', {
      '@context': this.baseContext,
      '@type': 'Article',
      headline: data.title,
      description: data.description,
      image: data.image,
      author: this._person(data.author),
      publisher: this._organization(data.publisher),
      datePublished: data.datePublished,
      dateModified: data.dateModified || data.datePublished,
      articleBody: data.body,
      url: data.url,
      ...data.extra,
    });
  }

  // 生成 FAQPage Schema
  faq(questions) {
    return this._build('FAQPage', {
      '@context': this.baseContext,
      '@type': 'FAQPage',
      mainEntity: questions.map((q) => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answer,
        },
      })),
    });
  }

  // 生成 HowTo Schema
  howTo(data) {
    return this._build('HowTo', {
      '@context': this.baseContext,
      '@type': 'HowTo',
      name: data.name,
      description: data.description,
      totalTime: data.totalTime,
      supply: data.supplies?.map((s) => ({ '@type': 'HowToSupply', name: s })),
      tool: data.tools?.map((t) => ({ '@type': 'HowToTool', name: t })),
      step: data.steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
        url: step.url,
        image: step.image,
      })),
    });
  }

  // 生成 BreadcrumbList Schema
  breadcrumb(items) {
    return this._build('BreadcrumbList', {
      '@context': this.baseContext,
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  // 生成 Organization Schema
  organization(data) {
    return this._build('Organization', {
      '@context': this.baseContext,
      '@type': 'Organization',
      name: data.name,
      url: data.url,
      logo: data.logo,
      description: data.description,
      sameAs: data.sameAs,
    });
  }

  // 构建并验证
  _build(type, data) {
    const schema = SchemaTypes[type];
    if (!schema) {
      throw new Error(`Unknown schema type: ${type}`);
    }

    // 验证必填字段
    const missing = schema.required.filter((field) => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      throw new Error(`Schema "${type}" missing required fields: ${missing.join(', ')}`);
    }

    // 清理空值
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value) && value.length === 0) continue;
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  // 输出 HTML script 标签
  toScript(data) {
    return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
  }

  _person(data) {
    if (!data) return undefined;
    if (typeof data === 'string') return { '@type': 'Person', name: data };
    return { '@type': 'Person', ...data };
  }

  _organization(data) {
    if (!data) return undefined;
    if (typeof data === 'string') return { '@type': 'Organization', name: data };
    return { '@type': 'Organization', ...data };
  }
}

// 使用示例
const sd = new StructuredData();

// 生成 Article
const articleSchema = sd.article({
  title: 'React 18 并发渲染详解',
  description: '深入理解 React 18 的并发特性',
  author: { name: '张伟', url: 'https://example.com/authors/zhangwei' },
  publisher: { name: 'TechBlog', logo: 'https://example.com/logo.png' },
  datePublished: '2024-06-01T00:00:00Z',
  url: 'https://example.com/blog/react-18-concurrent',
  image: 'https://example.com/images/react-18.png',
});

console.log(sd.toScript(articleSchema));

// 生成 FAQ
const faqSchema = sd.faq([
  {
    question: '什么是 React.memo？',
    answer: 'React.memo 是一个高阶组件，用于缓存函数组件的渲染结果。',
  },
  {
    question: 'useMemo 和 useCallback 有什么区别？',
    answer: 'useMemo 缓存计算结果，useCallback 缓存函数引用。',
  },
]);

console.log(sd.toScript(faqSchema));
```
