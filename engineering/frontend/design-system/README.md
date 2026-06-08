# Design System

设计系统训练 —— 达到"能建立设计规范、能构建组件库、能维护 Design Tokens、能跨团队协作"的水平。

## 训练哲学

1. **系统化思维**：设计不是零散的文件，而是可复用、可扩展、可维护的体系。
2. **Design Tokens 驱动**：颜色、间距、字体等原子值是设计系统的 DNA。
3. **组件即 API**：好的组件设计像好的 API 设计——简单、可预测、可组合。
4. **文档即产品**：没有文档的设计系统等于不存在。

## 体系索引

### 设计基础
| 文档 | 内容 |
|------|------|
| [01-design-system-fundamentals.md](01-design-system-fundamentals.md) | 设计系统基础：原子设计、Design Tokens、设计系统 vs 组件库 |

### 视觉系统
| 文档 | 内容 |
|------|------|
| [02-color-system.md](02-color-system.md) | 色彩系统：色板、语义化颜色、暗黑模式、对比度/WCAG |
| [03-typography-system.md](03-typography-system.md) | 排版系统：字体比例、行高、字重、响应式排版 |
| [04-spacing-layout.md](04-spacing-layout.md) | 间距与布局：间距比例、Grid 系统、断点、容器 |

### 组件与资产
| 文档 | 内容 |
|------|------|
| [05-component-design.md](05-component-design.md) | 组件设计：原子组件、复合组件、API 设计、受控/非受控、组合模式 |
| [06-icon-system.md](06-icon-system.md) | 图标系统：SVG 图标、尺寸规范、语义化、无障碍 |
| [07-motion-system.md](07-motion-system.md) | 动效系统：过渡曲线、时长规范、微交互、prefers-reduced-motion |

### 工程与文档
| 文档 | 内容 |
|------|------|
| [08-theme-tokens.md](08-theme-tokens.md) | 主题与变量：CSS 变量、Design Tokens、主题切换、多品牌 |
| [09-documentation.md](09-documentation.md) | 文档规范：Storybook、使用指南、设计规范、变更日志 |
| [10-multi-platform.md](10-multi-platform.md) | 多平台适配：跨平台 Tokens、React/Vue/Web Components、Figma 同步 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/design-tokens.md](mini-impl/design-tokens.md) | 手写 Design Tokens 生成器：JSON → CSS/SCSS/JS |
| [mini-impl/theme-switcher.md](mini-impl/theme-switcher.md) | 手写主题切换：CSS 变量、localStorage、系统偏好 |
| [mini-impl/component-base.md](mini-impl/component-base.md) | 手写组件基类：样式合并、变体系统、 forwardedRef |

## 设计系统构建决策树

```
从零开始构建设计系统？
  ├─ 是 → 已有设计稿（Figma）？
  │         ├─ 是 → 提取 Design Tokens → 建立变量 → 构建组件
  │         └─ 否 → 先建立设计规范（颜色/排版/间距）→ Tokens → 组件
  │
  └─ 否（已有组件库）→ 需要规范化？
           ├─ 是 → 提取现有值 → 标准化为 Tokens → 重构组件
           └─ 否 → 补充文档、测试、多平台适配
```
