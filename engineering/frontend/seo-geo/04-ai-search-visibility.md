# AI 搜索可见性

## 1. Perplexity 优化

Perplexity 是目前最透明的 AI 搜索引擎，每句话都标注来源。

### 优化策略

```markdown
## 内容结构要求
1. **直接回答开头**：前 100 字必须给出明确答案
2. **分点论述**：使用编号列表，每点一个独立事实
3. **引用数据**：包含具体数字和百分比
4. **时效性标注**：明确标注数据年份

## Perplexity 引用特点
- 优先引用有明确标题和摘要的页面
- 偏好 .edu、.gov 和知名媒体域名
- 对 FAQ/HowTo 结构的内容引用率更高
- 实时性内容（新闻）需要频繁更新
```

```html
<!-- Perplexity 友好的页面结构 -->
<article>
  <h1>React 18 并发渲染详解</h1>
  
  <!-- 直接回答 -->
  <div class="summary">
    React 18 的并发渲染允许 React 中断和恢复渲染工作，
    从而保持 UI 响应性。核心 API 包括 useTransition、useDeferredValue 和 Suspense。
  </div>
  
  <!-- 详细分点 -->
  <h2>1. useTransition</h2>
  <p>useTransition 用于标记非紧急更新...</p>
  
  <h2>2. useDeferredValue</h2>
  <p>useDeferredValue 用于延迟更新非关键部分...</p>
  
  <!-- FAQ 部分 -->
  <section itemscope itemtype="https://schema.org/FAQPage">
    <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <h3 itemprop="name">并发渲染会影响现有代码吗？</h3>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
        <p itemprop="text">
          不会。React 18 采用渐进式升级策略，只有使用新特性（如 createRoot）的应用才会启用并发模式。
        </p>
      </div>
    </div>
  </section>
</article>
```

## 2. Google AI Overviews 优化

Google AI Overviews 在搜索结果顶部直接生成答案。

```markdown
## 优化要点
1. **E-E-A-T 信号必须强**：作者资质、网站权威性、内容准确性
2. **结构化数据**：FAQPage、HowTo、Article Schema 必须完整
3. **首段摘要**：Google 优先提取前 2-3 段作为 AI Overview 素材
4. **多媒体内容**：图片、表格、代码块增加被引用的概率

## 被 AI Overview 引用的特征
- 页面在相关关键词的有机排名中位于前 10
- 内容被权威网站引用或链接
- 有明确的发布日期和更新日期
- 内容长度适中（1500-3000 字）
```

## 3. ChatGPT 优化

ChatGPT 的知识来自训练数据 + 可选的 Bing 实时搜索。

```markdown
## 训练数据中的可见性
- 内容出现在高质量数据集中（Common Crawl、GitHub、Wikipedia、Stack Overflow）
- 被频繁引用的内容权重更高
- 技术文档、教程类内容引用率较高

## Bing 实时搜索（ChatGPT Plus）
- 与 Bing 搜索优化策略相同
- 结构化数据（Schema.org）有助于 Bing 理解内容
- 网站需要在 Bing Webmaster Tools 中注册
```

## 4. DeepSeek 优化

DeepSeek 以推理能力见长，会展示详细的思考过程。

```markdown
## DeepSeek 特点
- 偏好结构化、逻辑清晰的内容
- 对代码示例和技术细节引用率高
- 中英文内容都有较好的理解能力
- 对实时信息依赖较少（知识截止较早）

## 优化建议
1. 提供完整的逻辑链条（问题 → 分析 → 方案 → 验证）
2. 代码示例要完整可运行
3. 技术对比表格（框架 A vs 框架 B）
4. 常见问题解答（FAQ）格式
```

## 5. 知识图谱与品牌实体

```html
<!-- 在 Wikipedia 上创建品牌页面（如果有条件） -->
<!-- 在 Wikidata 上注册实体 -->

<!-- 网站上使用 SameAs 链接 -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "MyCompany",
  "url": "https://mycompany.com",
  "sameAs": [
    "https://www.wikidata.org/entity/Q12345678",
    "https://en.wikipedia.org/wiki/MyCompany",
    "https://twitter.com/mycompany",
    "https://github.com/mycompany"
  ],
  "logo": "https://mycompany.com/logo.png"
}
</script>
```

## 6. 监控工具

| 工具 | 用途 |
|------|------|
| **Perplexity** | 手动查询关键词，检查是否被引用 |
| **Google Search Console** | 监控 AI Overview 展示次数 |
| **Brand24 / Mention** | 监控品牌在各平台的提及 |
| **BrightEdge / Semrush** | AI 搜索排名追踪 |
| **自定义脚本** | 定期查询 AI API，统计引用情况 |
