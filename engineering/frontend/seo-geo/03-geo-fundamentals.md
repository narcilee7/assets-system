# GEO 基础（Generative Engine Optimization）

## 1. 什么是 GEO

GEO = Generative Engine Optimization，即**生成式引擎优化**。

传统 SEO 的目标是：让网页在搜索结果中**排名靠前**。
GEO 的目标是：让内容被 AI 搜索引擎（ChatGPT、Perplexity、Google AI Overviews、DeepSeek）**引用和推荐**。

```
传统 SEO：
用户Query → 搜索引擎 → 排名结果列表 → 用户点击链接

GEO：
用户Query → AI引擎 → 综合多源生成答案 → 附带引用来源
         ↑                              ↓
    你的内容被引用 ←─────────────────────┘
```

## 2. AI 搜索引擎如何工作

```
用户输入 → 意图理解 → 信息检索 → 内容综合 → 生成回答 → 引用标注
              ↓            ↓            ↓
         查询重写      多源检索      可信度评分
         实体识别      RAG增强       事实核查
```

| 引擎 | 技术特点 | 引用方式 |
|------|---------|---------|
| **ChatGPT** | GPT-4 + Bing 搜索（部分模型） | 内联标注 [^1^] |
| **Perplexity** | 专用 RAG 架构，实时检索 | 每句话都有来源标注 |
| **Google AI Overviews** | Gemini + Google 搜索索引 | 卡片式来源展示 |
| **DeepSeek** | MoE 架构，深度推理 | 推理过程 + 最终答案 |
| **Claude** | Anthropic 自研模型 | 不联网（纯知识截止） |

## 3. GEO vs SEO 对比

| 维度 | SEO | GEO |
|------|-----|-----|
| **目标** | 页面排名 | 内容被引用 |
| **优化对象** | 爬虫 + 排名算法 | AI 模型 + RAG 系统 |
| **关键要素** | 关键词密度、外链、技术性能 | 结构化、权威性、准确性 |
| **内容形式** | 完整页面 | 可被提取的事实片段 |
| **更新频率** | 索引周期（天/周） | 实时或近实时 |
| **可控性** | 高（有明确排名因素） | 中（AI 黑盒决策） |

## 4. GEO 核心策略

### 策略 1：结构化内容（AI 最容易提取）

```markdown
## ❌ 不容易被引用
React 性能优化需要考虑很多因素。代码分割、懒加载、memo 都是常用的方法。
Bundle size 也很重要。你应该使用 Webpack 或 Vite 来优化构建。

## ✅ 容易被引用
React 性能优化的核心策略包括：

1. **组件级优化**
   - 使用 `React.memo` 防止不必要的重渲染
   - 使用 `useMemo` 缓存复杂计算
   - 使用 `useCallback` 缓存函数引用

2. **加载优化**
   - 路由级代码分割：`React.lazy()` + `Suspense`
   - 组件级懒加载：动态 import
   - 第三方库按需加载

3. **构建优化**
   - Tree Shaking 移除未使用代码
   - 图片格式优化：WebP/AVIF
   - 启用 Gzip/Brotli 压缩

根据 2024 年 State of JS 调查，使用代码分割的 React 应用首屏加载时间平均减少 40%。
```

### 策略 2：权威引用（增强可信度）

```markdown
## 在内容中引用权威来源

React 18 引入了并发渲染（Concurrent Rendering），这一特性允许 React
在渲染过程中暂停和恢复工作 [React 官方文档, 2022]。

根据 Google 的 Core Web Vitals 标准，LCP（Largest Contentful Paint）
应控制在 2.5 秒以内 [Google Search Central, 2024]。

Facebook 的工程团队报告，通过实施代码分割，他们的主包体积减少了 30%，
首屏时间减少了 50% [Facebook Engineering Blog, 2021]。
```

### 策略 3：FAQ 格式（直接回答用户问题）

```markdown
## React.useMemo 的作用是什么？

**简短回答**：`useMemo` 用于缓存计算结果，避免在每次渲染时重复执行昂贵的计算。

**详细解释**：
当组件的依赖项没有变化时，`useMemo` 会返回之前缓存的计算结果。
这在以下场景特别有用：
- 复杂的数组过滤/排序操作
- 对象/数组的稳定引用（用于子组件 Props）
- 图表数据计算

**使用示例**：
```javascript
const filteredData = useMemo(
  () => data.filter(item => item.active),
  [data]
);
```

**注意事项**：
- `useMemo` 本身有开销，仅在性能瓶颈处使用
- React 可能在未来版本丢弃缓存（useMemo 语义保证）
```

## 5. GEO 可量化指标

| 指标 | 测量方式 | 目标 |
|------|---------|------|
| **引用率** | 查询 AI 引擎，统计你的内容被引用的次数 | 逐步提升 |
| **品牌提及** | 监控 AI 回答中是否提到你的品牌 | 稳定出现 |
| **回答准确性** | AI 引用你的内容时是否准确 | 100% |
| **引用位置** | 引用出现在回答的前段还是后段 | 前段 |
