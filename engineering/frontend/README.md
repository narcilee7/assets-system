# Frontend Architecture

前端能力目标是架构师水平：不只是会写页面和组件，而是能设计复杂前端系统、选择技术栈、治理工程体系、支撑多端交付，并对性能、稳定性、体验和团队效率负责。

## 前端架构师能力模型

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 UI Implementation | HTML / CSS / JS / TS、组件实现、交互状态 | 能高质量实现页面 |
| L2 Framework Proficiency | React / Vue / Angular / Next / Nuxt 深度机制 | 能解释框架原理和边界 |
| L3 Engineering System | 构建、包管理、测试、CI、发布、质量门禁 | 能搭建团队级工程体系 |
| L4 Application Architecture | 状态、路由、权限、数据流、模块边界、微前端 | 能设计复杂应用架构 |
| L5 Cross-platform Architecture | RN、JSBridge、H5、WebView、小程序、Electron | 能统一多端能力和体验 |
| L6 Frontend Platform Architecture | 组件平台、低代码、监控、性能平台、DevEx | 能做平台化和技术治理 |
| L7 AI Frontend Architecture | Agent UI、Streaming UI、AI IDE、工具状态可视化 | 能构建 AI 原生前端体验 |

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| Frameworks | `frameworks/` | React、Vue、Angular、Next、Nuxt、Svelte、mini framework |
| Frontend Engineering | `frontend-engineering/` | 构建、包管理、Monorepo、CI/CD、测试、发布、DevEx |
| Browser Platform | `browser-platform/` | DOM、BOM、事件、存储、网络、渲染、安全 |
| State Management | `state-management/` | local/server/cache/form/global 状态和数据流 |
| Rendering Performance | `rendering-performance/` | 渲染链路、Core Web Vitals、长任务、虚拟列表 |
| Component Design | `component-design/` | 组件 API、组合、受控/非受控、可访问性 |
| Design System | `design-system/` | token、主题、组件规范、文档、版本 |
| Micro Frontend | `micro-frontend/` | qiankun、single-spa、module federation、隔离、通信 |
| Cross Platform | `cross-platform/` | RN、JSBridge、H5、WebView、小程序、Electron |
| Architecture | `architecture/` | 分层、模块边界、权限、路由、插件化、平台化 |
| Quality | `quality/` | 单测、组件测试、E2E、视觉回归、契约测试 |
| Security | `security/` | XSS、CSRF、CSP、供应链、权限和数据边界 |
| Observability | `observability/` | 前端监控、错误、性能、行为、Source Map |
| AI Frontend | `ai-frontend/` | Streaming UI、Agent event、工具调用状态、人机协同 |
| Case Studies | `case-studies/` | 用实际系统串联能力 |
| Patterns | `patterns/` | debounce、virtual list、form manager 等构件 |

## Framework 深度要求

架构师级 Framework 能力不是“会用”，而是能解释和取舍：

| 方向 | 必须掌握 |
| --- | --- |
| React | Fiber、Hooks、Concurrent、Context、memo、Suspense、Server Components |
| Vue | 响应式、effect、scheduler、compiler、Composition API、Pinia |
| Angular | DI、RxJS、Zone、Change Detection、Module / Standalone |
| Next.js | SSR、SSG、ISR、RSC、App Router、Edge、cache |
| Nuxt | SSR、Nitro、auto import、server routes、hydration |
| Mini Framework | reactive、vdom、scheduler、router、store |

## 前端工程化 ALL

| 领域 | 必须覆盖 |
| --- | --- |
| Build Tooling | Vite、Webpack、Rspack、Rollup、esbuild、SWC、Babel、PostCSS |
| Package Management | npm、pnpm、yarn、workspace、lockfile、peer dependency |
| Monorepo | pnpm workspace、Turborepo、Nx、changeset、dependency graph |
| Type System | TypeScript config、declaration、API typing、strict mode |
| Code Quality | ESLint、Prettier、Stylelint、commitlint、review rules |
| Testing | Vitest、Jest、Testing Library、Playwright、Cypress、MSW |
| Release | semantic version、changeset、canary、rollback |
| Performance Budget | bundle、LCP、INP、CLS、long task、hydration |
| DevEx | scaffold、CLI、template、local mock、debugging |
| Supply Chain | audit、license、provenance、private registry |

## 跨端要求

| 方向 | 必须掌握 |
| --- | --- |
| React Native | bridge、JSI、TurboModule、Fabric、性能、热更新 |
| JSBridge | schema、权限、回调、版本兼容、安全 |
| H5 / WebView | 容器能力、注入、登录态、离线包、白屏治理 |
| 小程序 | 生命周期、分包、setData、性能、平台差异 |
| Electron | main / renderer、IPC、auto update、native integration、安全 |
| Hybrid Architecture | 能力抽象、多端路由、统一埋点、灰度和降级 |

## 架构师级追问

- 为什么这个业务适合 CSR、SSR、SSG、ISR 或 RSC？
- 状态应该放在 URL、组件、全局 store、server cache 还是后端？
- 多团队如何共用组件和工程规范？
- 微前端是否值得，隔离、通信和发布怎么治理？
- WebView 白屏、JSBridge 失败、离线包回滚如何处理？
- 前端错误如何归因到版本、用户、接口和设备？
- 如何设计 Agent Streaming UI 的事件协议和状态机？

## P0 资产

| 资产 | 目录 | 状态 |
| --- | --- | --- |
| React architecture deep dive | `frameworks/react/` | todo |
| Vue reactivity deep dive | `frameworks/vue/` | todo |
| frontend engineering blueprint | `frontend-engineering/` | todo |
| micro frontend decision framework | `micro-frontend/` | todo |
| JSBridge design | `cross-platform/jsbridge/` | todo |
| WebView container playbook | `cross-platform/h5-webview/` | todo |
| frontend observability baseline | `observability/` | todo |
| Streaming Agent UI | `ai-frontend/` | todo |

