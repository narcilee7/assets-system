# 数据可视化工程化

数据可视化工程化训练 —— 达到"能选型渲染架构、能处理大数据量、能设计交互系统、能构建图表组件库"的水平。

## 训练哲学

1. **渲染层决定上限**：Canvas/SVG/WebGL 各有适用域，选型错误会导致后期无法补救。
2. **性能是可视化的命**：10万条数据如果用 DOM 渲染直接卡死，必须用分层渲染 + 虚拟化。
3. **交互是产品的魂**：没有刷选、联动、下钻的图表只是静态图片。
4. **可访问性被严重忽视**：色盲用户、屏幕阅读器用户也需要理解你的图表。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-rendering-architecture.md](01-rendering-architecture.md) | 渲染架构：Canvas vs SVG vs WebGL vs DOM 对比选型、混合渲染策略 |
| [02-performance-optimization.md](02-performance-optimization.md) | 性能优化：大数据量渲染、虚拟化、增量渲染、离屏渲染、LOD |
| [03-interaction-system.md](03-interaction-system.md) | 交互系统：缩放/平移、刷选、Tooltip、联动、事件委托 |
| [04-animation-engine.md](04-animation-engine.md) | 动画引擎：过渡动画、缓动函数、FLIP、requestAnimationFrame 调度 |
| [05-chart-engineering.md](05-chart-engineering.md) | 图表工程化：主题系统、组件封装、响应式、可访问性、测试 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/render-engine.md](mini-impl/render-engine.md) | 手写混合渲染引擎（Canvas 主渲染 + SVG 交互层） |
| [mini-impl/chart-component.md](mini-impl/chart-component.md) | 手写图表组件系统（声明式配置 + 主题化 + 可组合） |
| [mini-impl/data-transform.md](mini-impl/data-transform.md) | 手写数据变换管道（Scale/Axis/Layout/Stack） |

## 渲染选型决策树

```
数据量？
  ├─ < 1,000 点 → SVG（可访问性好、交互简单）
  ├─ 1,000 ~ 100,000 点 → Canvas（性能平衡）
  └─ > 100,000 点 → WebGL（GPU 加速）

交互需求？
  ├─ 简单（悬停显示值） → 任意渲染层
  ├─ 复杂（刷选、联动） → Canvas + SVG 叠加层
  └─ 3D / 粒子 → WebGL

是否需要 DOM 事件？
  ├─ 是 → SVG 或 Canvas + 透明 SVG 叠加层
  └─ 否 → Canvas / WebGL

动态更新频率？
  ├─ 实时流（> 10fps） → Canvas / WebGL
  ├─ 偶发更新 → SVG
  └─ 静态 → SVG / 图片
```
