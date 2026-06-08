# Frontend Frameworks

前端框架训练 —— 达到"能用、能解释、能优化、能取舍、能局部实现"的水平。

## 训练哲学

1. **原理驱动使用**：知道 Fiber 为什么存在，才能正确使用 Concurrent Features。
2. **从简化实现到生产源码**：先手写一个最小可用版（mini-framework），再看真实源码的演化。
3. **对比中找本质**：React 的不可变数据 + Vue 的响应式追踪 + Svelte 的编译时优化，殊途同归。
4. **全链路复盘**：每个框架用统一的 8 维度模板审视——渲染模型、状态模型、调度模型、编译/运行时边界、SSR/Hydration、性能瓶颈、工程取舍、适用场景。

## 体系索引

### React
| 文档 | 内容 |
|------|------|
| [fiber.md](react/fiber.md) | Fiber 架构：链表树、双缓冲、render/commit 两阶段、工作循环 |
| [hooks.md](react/hooks.md) | Hooks 原理：闭包陷阱、链表组织、dispatch、batching、useEffect 调度 |
| [concurrent.md](react/concurrent.md) | Concurrent 模式：时间切片、优先级 lane、transition、useDeferredValue |
| [suspense.md](react/suspense.md) | Suspense 边界：数据获取、Error Boundary、Streaming SSR |
| [rsc.md](react/rsc.md) | Server Components：client/server 边界、序列化限制、Bundler 集成 |
| [state-patterns.md](react/state-patterns.md) | 状态策略：local / lifting / context / external store / server state 选择 |

### Vue
| 文档 | 内容 |
|------|------|
| [reactivity.md](vue/reactivity.md) | 响应式系统：Proxy 拦截、依赖收集、trigger、effect、scheduler |
| [compiler.md](vue/compiler.md) | 编译器：template → AST → transform → render function、block tree、静态提升 |
| [scheduler.md](vue/scheduler.md) | 调度器：job queue、flush timing、pre/post、watch vs watchEffect |
| [composition-api.md](vue/composition-api.md) | Composition API：setup、生命周期映射、逻辑复用、与 Options API 对比 |
| [pinia.md](vue/pinia.md) | Pinia：去除 mutation 的状态管理、store 组合、SSR 友好 |

### Angular
| 文档 | 内容 |
|------|------|
| [dependency-injection.md](angular/dependency-injection.md) | 依赖注入：Injector 树、provider、层级解析、tree-shakable |
| [change-detection.md](angular/change-detection.md) | 变更检测：Zone.js、OnPush、MarkForCheck、Signals 变革 |
| [signals.md](angular/signals.md) | Signals：signal、computed、effect、与 RxJS 的关系和迁移 |
| [rxjs-patterns.md](angular/rxjs-patterns.md) | RxJS 模式：Observable、Subject、操作符、冷热 Observable、内存管理 |

### Svelte
| 文档 | 内容 |
|------|------|
| [compile-time.md](svelte/compile-time.md) | 编译时框架：无 Virtual DOM、AST 分析、细粒度 DOM 更新生成 |
| [reactivity-runes.md](svelte/reactivity-runes.md) | Runes：$state、$derived、$effect、与 Svelte 4 响应式的演进 |
| [ssr-hydration.md](svelte/ssr-hydration.md) | SSR 与 Hydration：SvelteKit 渲染策略、渐进增强 |

### Next.js
| 文档 | 内容 |
|------|------|
| [rendering-strategies.md](nextjs/rendering-strategies.md) | 渲染策略：SSR / SSG / ISR / CSR / RSC 决策树与适用场景 |
| [app-router.md](nextjs/app-router.md) | App Router：layout / page / loading / error / parallel / intercepting routes |
| [rsc.md](nextjs/rsc.md) | React Server Components：Bundler 集成、flight protocol、client boundary |
| [caching.md](nextjs/caching.md) | 缓存体系：Data Cache / Router Cache / Full Route Cache / revalidate |
| [server-actions.md](nextjs/server-actions.md) | Server Actions：progressive enhancement、mutation、redirect、错误处理 |

### Nuxt
| 文档 | 内容 |
|------|------|
| [nitro-engine.md](nuxt/nitro-engine.md) | Nitro：universal server、auto-scan API、presets、Edge 部署 |
| [rendering-hydration.md](nuxt/rendering-hydration.md) | 渲染与水合：SSR / SSG / ISR / Islands、payload 优化 |
| [auto-imports.md](nuxt/auto-imports.md) | 自动导入：composables、components、utils 的扫描与解析 |

### Mini Framework（手写实现）
| 文档 | 内容 |
|------|------|
| [README.md](mini-framework/README.md) | 手写 React 核心：从 0 到 1 构建简化版框架 |
| [reactive-state.md](mini-framework/reactive-state.md) | 响应式基础：observe、notify、subscriber、effect |
| [vdom-diff.md](mini-framework/vdom-diff.md) | VDOM 与 Diff：h、createElement、patch、keyed diff |
| [fiber-scheduler.md](mini-framework/fiber-scheduler.md) | Fiber + Scheduler：workLoop、priority、yield、interrupt |
| [hooks-impl.md](mini-framework/hooks-impl.md) | Hooks 实现：hooks 链表、useState、useEffect、batching |

## 统一复盘模板

阅读完每个框架后，用以下 8 维度复盘：

```
1. 渲染模型        // 如何描述 UI？如何映射到 DOM？
2. 状态模型        // 如何追踪变化？如何触发更新？
3. 调度模型        // 更新是同步还是异步？优先级如何排序？
4. 编译/运行时边界  // 哪些工作在构建时做？哪些在运行时做？
5. SSR / Hydration // 服务端如何渲染？客户端如何接管？
6. 性能瓶颈        // 最常见的性能问题是什么？如何优化？
7. 工程取舍        // 框架做了哪些 trade-off？为什么？
8. 适用场景        // 什么项目适合用它？什么不适合？
```
