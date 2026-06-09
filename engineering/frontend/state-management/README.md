# State Management

状态管理训练 —— 达到"能分类、能选型、能设计、能优化、能手写"的水平。

## 训练哲学

1. **先分类再选型**：不是所有状态都需要全局管理。Local / Global / Server / URL / Form 各有不同归宿。
2. **派生优先存储**：能算出来的不要存，用 selector / computed 保持单一数据源。
3. **服务端状态 ≠ 客户端状态**：缓存、失效、重试、去重是服务端状态的核心问题。
4. **从手写理解本质**：Redux 就是一个发布订阅 + reducer，Zustand 就是一个闭包 + Proxy。

## 体系索引

### 核心理论
| 文档 | 内容 |
|------|------|
| [01-state-taxonomy.md](01-state-taxonomy.md) | 状态分类学：Local / Global / Server / URL / Form / Session |
| [02-design-principles.md](02-design-principles.md) | 设计原则：单一职责、最小化、派生优先、规范化、不可变性 |

### React 生态
| 文档 | 内容 |
|------|------|
| [03-redux.md](03-redux.md) | Redux 体系：Core / Redux Toolkit / RTK Query / Middleware |
| [04-zustand.md](04-zustand.md) | Zustand：轻量、无样板、TypeScript 友好、跨框架 |
| [05-jotai-recoil.md](05-jotai-recoil.md) | 原子化状态：Jotai、Recoil、原子依赖图 |
| [06-mobx-valtio.md](06-mobx-valtio.md) | 可变状态：MobX、Valtio、Proxy 自动追踪 |

### 服务端状态
| 文档 | 内容 |
|------|------|
| [07-tanstack-query.md](07-tanstack-query.md) | TanStack Query：缓存策略、stale-while-revalidate、mutation |
| [08-swr-apollo.md](08-swr-apollo.md) | SWR、Apollo Client：GraphQL 缓存、乐观更新 |

### Vue / Angular
| 文档 | 内容 |
|------|------|
| [09-pinia.md](09-pinia.md) | Pinia：Vue 官方状态管理、Composition API 集成 |

### 高级话题
| 文档 | 内容 |
|------|------|
| [10-url-state.md](10-url-state.md) | URL 状态：路由参数、查询字符串、Nuqs、可分享状态 |
| [11-persistence-sync.md](11-persistence-sync.md) | 持久化与同步：localStorage、IndexedDB、BroadcastChannel |
| [12-architecture-patterns.md](12-architecture-patterns.md) | 架构模式：分层、模块组织、跨组件通信、微前端状态 |
| [13-performance-optimization.md](13-performance-optimization.md) | 性能优化：避免重渲染、selector、拆分、记忆化 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/redux.md](mini-impl/redux.md) | 手写 Redux：createStore、dispatch、subscribe、middleware |
| [mini-impl/zustand.md](mini-impl/zustand.md) | 手写 Zustand：create、subscribe、selector、shallow |
| [mini-impl/jotai.md](mini-impl/jotai.md) | 手写 Jotai：atom、useAtom、derived atom、atom  family |
| [mini-impl/tanstack-query.md](mini-impl/tanstack-query.md) | 手写 TanStack Query：cache、stale time、refetch、mutation |

## 状态选型决策树

```
状态需要跨组件共享？
  ├─ 否 → useState / useReducer（Local State）
  │
  └─ 是 → 状态来源？
           ├─ 服务端 API → TanStack Query / SWR / RTK Query
           │
           ├─ URL 参数 → 路由 query params / Nuqs
           │
           ├─ 表单 → React Hook Form / Formik（URL 无关）
           │          或 URL sync（表单可分享）
           │
           └─ 客户端派生 → 全局状态库
                    ├─ 简单、少量 → Context + useReducer
                    ├─ 中等、快速 → Zustand
                    ├─ 复杂、严格 → Redux Toolkit
                    ├─ 细粒度、原子 → Jotai / Recoil
                    └─ OOP / 可变 → MobX / Valtio
```
