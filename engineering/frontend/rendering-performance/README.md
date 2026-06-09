# Rendering Performance

渲染性能训练 —— 达到"能理解渲染管线、能定位性能瓶颈、能实施优化方案、能量化改进效果"的水平。

## 训练哲学

1. **理解管线再优化**：不知道浏览器怎么渲染，优化就是瞎猜。
2. **测量驱动**：先建立基准，再优化，再验证。
3. **80/20 法则**：Web Vitals 三项指标解决 80% 的用户体验问题。
4. **渐进增强**：先保证功能正确，再逐步叠加性能优化。

## 体系索引

### 渲染基础
| 文档 | 内容 |
|------|------|
| [01-browser-rendering-pipeline.md](01-browser-rendering-pipeline.md) | 浏览器渲染管线：HTML→CSSOM→Render Tree→Layout→Paint→Composite |

### 核心指标与优化
| 文档 | 内容 |
|------|------|
| [02-web-vitals-optimization.md](02-web-vitals-optimization.md) | Web Vitals 深度优化：LCP/INP/CLS/TTFB/FCP 的测量与改进 |
| [03-code-splitting-lazy-loading.md](03-code-splitting-lazy-loading.md) | 代码分割与懒加载：路由分割、动态导入、图片懒加载、预加载策略 |
| [04-virtual-list.md](04-virtual-list.md) | 虚拟列表：固定高度、动态高度、双向缓冲、瀑布流 |
| [05-image-optimization.md](05-image-optimization.md) | 图片优化：格式选择、响应式图片、懒加载、CDN、SVG |
| [06-font-optimization.md](06-font-optimization.md) | 字体优化：FOIT/FOUT、font-display、预加载、子集化 |

### 技术深度优化
| 文档 | 内容 |
|------|------|
| [07-css-performance.md](07-css-performance.md) | CSS 性能：选择器优化、contain、will-change、CSS 动画 |
| [08-js-execution-optimization.md](08-js-execution-optimization.md) | JS 执行优化：长任务拆分、Web Workers、requestIdleCallback、事件节流 |
| [09-caching-strategies.md](09-caching-strategies.md) | 缓存策略：HTTP 缓存、Service Worker、预加载、离线优先 |
| [10-framework-optimization.md](10-framework-optimization.md) | 框架特定优化：React.memo、Vue keep-alive、Svelte 编译优化 |
| [11-critical-rendering-path.md](11-critical-rendering-path.md) | 关键渲染路径：内联关键 CSS、延迟非关键 JS、资源优先级 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/virtual-list.md](mini-impl/virtual-list.md) | 手写虚拟列表：固定高度、动态高度、缓冲池 |
| [mini-impl/lazy-image.md](mini-impl/lazy-image.md) | 手写图片懒加载：Intersection Observer、占位图、渐变加载 |
| [mini-impl/task-scheduler.md](mini-impl/task-scheduler.md) | 手写长任务拆分调度器：yield、优先级、时间片 |

## 性能优化决策树

```
页面加载慢？
  ├─ 首屏内容出现晚 → LCP 优化（图片/字体/阻塞资源）
  ├─ 交互卡顿 → INP 优化（长任务/事件处理/DOM 操作）
  ├─ 页面跳动 → CLS 优化（图片尺寸/字体/动态内容）
  ├─ 白屏时间长 → 关键渲染路径优化（CSS/JS 加载顺序）
  └─ 整体慢 → Bundle 分析 + 代码分割 + 缓存策略
```
