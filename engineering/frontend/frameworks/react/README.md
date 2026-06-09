# React Deep Dive

架构师级 React 能力：能解释 Fiber、Hooks、Concurrent 机制，理解渲染边界和性能优化。

## 深度主题

| 主题 | 核心问题 | 资产 |
|------|----------|------|
| Fiber | render phase 如何中断/恢复？fiber tree 和 workLoop 的关系？ | [fiber](fiber/) |
| Hooks | closure 如何捕获 deps？dispatch 如何触发更新？hooks 链表如何组织？ | [hooks](hooks/) |
| Concurrent | interruptible render 如何实现？transition 的优先级？ | [concurrent](concurrent/) |
| Suspense | fallback 如何与组件解耦？data fetching 的边界在哪里？ | [suspense](suspense/) |
| Server Components | client/server boundary 如何划分？RSC 的序列化限制？ | [server-components](server-components/) |
| State | local/context/external store/server state 的选择？ | [state](state/) |
| Performance | memo/useMemo/useCallback 的适用场景？key 的作用？ | [performance](performance/) |

## P0 资产

| 资产 | 目录 | 状态 |
|------|------|------|
| Fiber workLoop 手写 | `fiber/` | skeleton |
| useState + useReducer 手写 | `hooks/use-state/` | skeleton |
| useEffect 手写 | `hooks/use-effect/` | todo |
| Concurrent mode 手写 | `concurrent/` | todo |
| React rendering performance playbook | `performance/` | todo |
| RSC decision checklist | `server-components/` | todo |