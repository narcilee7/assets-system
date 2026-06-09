# 组件库工程化

组件库工程化训练 —— 达到"能设计架构、能构建产物、能管理发布、能维护质量"的水平。

## 训练哲学

1. **消费方体验优先**：组件库是给开发者用的产品，安装、引入、定制都要简单。
2. **产物决定一切**：ESM/CJS/UMD/d.ts/CSS 缺一不可，Tree Shaking 必须可用。
3. **Release 是设计的一部分**：版本策略、Breaking Change、迁移指南要提前规划。
4. **文档即产品**：没有文档的组件库等于不存在。

## 体系索引

### 架构与构建
| 文档 | 内容 |
|------|------|
| [01-architecture.md](01-architecture.md) | 架构设计：Monorepo vs Single Package、包拆分策略、目录结构 |
| [02-build-system.md](02-build-system.md) | 构建系统：ESM/CJS/UMD 输出、Tree Shaking、按需加载、Source Map |
| [03-type-system.md](03-type-system.md) | 类型系统：TypeScript 声明、.d.ts 生成、Props 导出、类型测试 |
| [04-style-system.md](04-style-system.md) | 样式系统：CSS-in-JS vs CSS Modules vs Less/Sass、主题变量、CSS 变量 |

### 文档与测试
| 文档 | 内容 |
|------|------|
| [05-documentation.md](05-documentation.md) | 文档站点：Storybook、Docusaurus/VitePress、Playground、API 文档 |
| [06-testing.md](06-testing.md) | 测试体系：单元测试、视觉回归、可访问性测试、跨浏览器测试 |

### Release 与质量
| 文档 | 内容 |
|------|------|
| [07-release-strategy.md](07-release-strategy.md) | Release 策略：SemVer、Breaking Change 管理、Canary、迁移指南 |
| [08-publishing.md](08-publishing.md) | 发布平台：NPM、私有 Registry、CDN 分发、产物验证 |
| [09-internationalization.md](09-internationalization.md) | 国际化：i18n 方案、RTL 支持、Locale 打包策略 |
| [10-quality-gate.md](10-quality-gate.md) | 质量门禁：Bundle Size 监控、Type Check、Coverage、Danger JS |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/build-script.md](mini-impl/build-script.md) | 手写构建脚本：Rollup 配置、多格式输出、样式提取 |
| [mini-impl/release-script.md](mini-impl/release-script.md) | 手写 Release 脚本：版本提升、Changelog 生成、Git Tag、NPM 发布 |
| [mini-impl/component-cli.md](mini-impl/component-cli.md) | 手写组件库 CLI：组件模板生成、文档同步、索引更新 |

## 组件库工程化决策树

```
构建组件库？
  ├─ 规模小（< 20 组件） → Single Package + Rollup/Vite
  ├─ 规模大（> 50 组件） → Monorepo + Changesets
  │
  ├─ 样式方案？
  │   ├─ CSS-in-JS → styled-components / emotion
  │   ├─ CSS Modules → 构建时提取 CSS
  │   └─ 预处理器 → Less/Sass + CSS 变量
  │
  ├─ 按需加载？
  │   ├─ Tree Shaking 友好 → ESM + sideEffects: false
  │   └─ Babel Plugin → babel-plugin-import / unplugin-vue-components
  │
  └─ 发布策略？
      ├─ 稳定版本 → SemVer + Conventional Commits
      ├─ 预览版本 → Canary / Beta / RC
      └─ 多版本共存 → dist-tag + 文档版本切换
```
