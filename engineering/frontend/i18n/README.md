# 前端国际化（i18n）工程化

前端国际化工程化训练 —— 达到"能设计多语言架构、能管理翻译生命周期、能处理 RTL 和本地化"的水平。

## 训练哲学

1. **i18n 是架构问题**：不是简单的字符串替换，涉及布局、日期、数字、复数、文化差异。
2. **翻译是产品**：翻译质量直接影响用户体验，需要流程化管理。
3. **RTL 不是边缘情况**：全球 6 亿+ 用户使用 RTL 语言（阿拉伯语、希伯来语等）。
4. **自动化是关键**：手动维护翻译文件是不可持续的。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-i18n-fundamentals.md](01-i18n-fundamentals.md) | i18n 基础：ICU MessageFormat、复数规则、日期/数字/货币格式化、RTL 布局 |
| [02-translation-management.md](02-translation-management.md) | 翻译管理：键值提取、翻译平台、版本控制、翻译质量 |
| [03-runtime-i18n.md](03-runtime-i18n.md) | 运行时 i18n：动态加载、语言切换、代码分割、SSR 多语言 |
| [04-i18n-testing.md](04-i18n-testing.md) | i18n 测试：视觉回归、RTL 布局测试、内容溢出、伪本地化 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/i18n-engine.md](mini-impl/i18n-engine.md) | 手写 i18n 引擎（ICU 解析 + 复数 + 插值） |
| [mini-impl/rtl-layout.md](mini-impl/rtl-layout.md) | 手写 RTL 布局适配器 |

## i18n 决策树

```
需要支持的地区？
  ├─ 单一语言区 → 延迟 i18n，硬编码
  ├─ 多语言（LTR 为主）→ react-intl / vue-i18n
  └─ 含 RTL 语言 → 必须 RTL 适配 + 逻辑属性

翻译来源？
  ├─ 开发团队维护 → JSON/YAML + Git 管理
  ├─ 专业翻译团队 → 集成 Crowdin/Lokalise/Phrase
  └─ 社区贡献 → 开放翻译平台

SSR 需求？
  ├─ 是 → 服务端渲染时确定语言 + 避免闪烁
  └─ 否 → 客户端检测 + 异步加载
```
