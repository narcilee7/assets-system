# HTML 工程化

HTML 工程化训练 —— 达到"能写出语义化、可访问、SEO 友好的结构化文档，能构建组件化 HTML 体系"的水平。

## 训练哲学

1. **HTML 是信息的骨架**：结构决定语义，语义决定可访问性和 SEO。
2. **可访问性不是附加功能**：从第一行 HTML 开始就要考虑屏幕阅读器和键盘导航。
3. **表单是用户交互的核心**：表单的工程化质量直接影响转化率。
4. **Web Components 是原生组件化**：无需框架即可实现封装、复用、组合。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-html-fundamentals.md](01-html-fundamentals.md) | HTML 工程化：语义化、可访问性、SEO、结构化数据 |
| [02-html-forms.md](02-html-forms.md) | 表单工程化：验证、无障碍、文件上传、进度、用户体验 |
| [03-html-performance.md](03-html-performance.md) | HTML 性能：预加载、懒加载、资源提示、关键路径 |
| [04-html-modern.md](04-html-modern.md) | 现代 HTML：Web Components、Shadow DOM、Template、Slot |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/component-system.md](mini-impl/component-system.md) | 手写 Web Components 简化系统 |
| [mini-impl/form-validator.md](mini-impl/form-validator.md) | 手写表单验证引擎 |

## HTML 工程化决策树

```
需要 SEO？
  ├─ 是 → 语义化标签 + 结构化数据 + meta 标签完善
  └─ 否 → 基本语义化即可

需要可访问性合规？
  ├─ 是（WCAG 2.1 AA）→ ARIA 属性 + 键盘导航 + 颜色对比度
  └─ 否 → 基础语义化标签

需要组件化？
  ├─ 无框架 → Web Components (Custom Elements + Shadow DOM)
  ├─ 有框架 → 框架组件系统
  └─ 混合 → Web Components 作为基础，框架作为应用层

表单复杂程度？
  ├─ 简单（<5 字段）→ 原生 HTML5 验证
  ├─ 中等（5-20 字段）→ 验证库 + 自定义规则
  └─ 复杂（20+ 字段/多步骤）→ 表单引擎 + 动态渲染
```
