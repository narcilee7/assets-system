# CSS 工程化

CSS 工程化训练 —— 达到"能设计可维护的样式架构、能优化渲染性能、能驾驭现代 CSS 特性"的水平。

## 训练哲学

1. **CSS 是全局状态**：没有作用域的样式系统就是技术债务。
2. **架构先于写法**：选错架构（BEM vs Utility vs CSS-in-JS）比写错代码代价更大。
3. **渲染性能是 CSS 的隐藏成本**：重排、重绘、合成层，每一个选择器都在影响帧率。
4. **现代 CSS 正在革命**：Container Queries、@layer、:has() 改变了我们写 CSS 的方式。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-css-fundamentals.md](01-css-fundamentals.md) | CSS 基础工程化：命名规范、层叠管理、CSS 变量、预处理器 |
| [02-css-architecture.md](02-css-architecture.md) | CSS 架构：ITCSS、Utility-first、Design Token、CSS-in-JS |
| [03-css-performance.md](03-css-performance.md) | CSS 性能：渲染路径、contain、will-change、关键 CSS |
| [04-css-modern.md](04-css-modern.md) | 现代 CSS：Container Queries、@layer、:has()、@property、Subgrid |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/css-processor.md](mini-impl/css-processor.md) | 手写简化 CSS 处理器（变量替换、嵌套展开） |
| [mini-impl/design-token-system.md](mini-impl/design-token-system.md) | 手写 Design Token 生成系统 |

## CSS 架构决策树

```
项目规模？
  ├─ 小型（<10 组件）→ BEM + CSS 变量即可
  ├─ 中型（10-50 组件）→ ITCSS + BEM + Design Token
  └─ 大型（50+ 组件）→ Utility-first (Tailwind) 或 CSS-in-JS

是否需要主题切换？
  ├─ 是 → CSS 变量 + Design Token
  └─ 否 → 预处理器变量

是否需要运行时动态样式？
  ├─ 是 → CSS-in-JS (styled-components / emotion)
  └─ 否 → 静态方案

性能要求极高？
  ├─ 是 → 零运行时开销（Tailwind / Linaria）
  └─ 否 → 可接受少量运行时开销
```
