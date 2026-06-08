# Micro Frontend

微前端训练 —— 达到"能判断是否需要微前端、能选型、能实施、能治理"的水平。

## 训练哲学

1. **不是银弹**：微前端增加复杂度，只在特定场景收益大于成本。
2. **隔离是核心**：JS、CSS、路由、状态的隔离决定方案成败。
3. **渐进式拆分**：从构建时集成 → 运行时集成 → 完全独立，逐步演进。
4. **治理优于技术**：公共依赖、版本策略、发布协调是长期挑战。

## 体系索引

### 架构基础
| 文档 | 内容 |
|------|------|
| [01-micro-frontend-fundamentals.md](01-micro-frontend-fundamentals.md) | 架构基础：定义、决策条件、架构模式对比、复杂度分析 |

### 核心技术
| 文档 | 内容 |
|------|------|
| [02-routing-navigation.md](02-routing-navigation.md) | 路由与导航：主应用路由、子应用路由、跨应用导航、历史管理 |
| [03-style-isolation.md](03-style-isolation.md) | 样式隔离：CSS Module、Shadow DOM、CSS-in-JS、命名约定、动态样式表 |
| [04-js-sandbox.md](04-js-sandbox.md) | JS 沙箱：快照沙箱、Proxy 沙箱、Legacy 沙箱、with 作用域 |
| [05-state-sharing.md](05-state-sharing.md) | 状态共享：Props 传递、Event Bus、全局 Store、URL 状态、登录态 |
| [06-shared-dependencies.md](06-shared-dependencies.md) | 公共依赖：Module Federation 共享、externals、依赖去重、版本冲突 |

### 方案深度
| 文档 | 内容 |
|------|------|
| [07-qiankun.md](07-qiankun.md) | qiankun：single-spa 封装、HTML Entry、生命周期、API、最佳实践 |
| [08-module-federation.md](08-module-federation.md) | Module Federation：Webpack 5、独立部署、运行时集成、共享作用域 |
| [09-iframe-solution.md](09-iframe-solution.md) | iframe 方案：postMessage、路由同步、弹窗处理、性能考量 |
| [10-web-components.md](10-web-components.md) | Web Components：Custom Elements、Shadow DOM、封装、框架集成 |
| [11-build-time-integration.md](11-build-time-integration.md) | 构建时集成：Monorepo + 构建时合并、子包发布、NPM 包集成 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/micro-loader.md](mini-impl/micro-loader.md) | 手写微前端加载器：应用注册、生命周期、挂载/卸载 |
| [mini-impl/js-sandbox.md](mini-impl/js-sandbox.md) | 手写 JS 沙箱：Proxy window、快照恢复、副作用收集 |
| [mini-impl/style-isolator.md](mini-impl/style-isolator.md) | 手写样式隔离：动态样式表、作用域前缀、Shadow DOM 封装 |

## 微前端选型决策树

```
需要微前端吗？
  ├─ 单团队 + 单技术栈 + 新应用 → 不需要，用 Monolith / Monorepo
  │
  └─ 多团队 / 多技术栈 / 存量整合 → 选择集成方式：
           │
           ├─ 强隔离需求（完全独立） → iframe
           │
           ├─ 技术栈相同（React/Vue） → qiankun / single-spa
           │
           ├─ 技术栈不同但需要紧密交互 → Web Components
           │
           ├─ 需要独立部署 + 共享依赖 → Module Federation
           │
           └─ 简单场景 / 过渡阶段 → 构建时集成（NPM 包 / Monorepo）
```
