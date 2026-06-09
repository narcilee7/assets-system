# Vue Deep Dive

架构师级 Vue 能力：能解释 Vue 3 响应式原理、effect/scheduler 机制，理解 Composition API 和 Pinia。

## 深度主题

| 主题 | 核心问题 | 资产 |
|------|----------|------|
| Reactivity | Proxy 如何拦截？effect 是如何收集依赖的？ | [reactivity](reactivity/) |
| effect/scheduler | effect 的执行时机？scheduler 如何控制更新？ | [effect-scheduler](effect-scheduler/) |
| Composition API | setup 如何工作？生命周期如何映射？ | [composition-api](composition-api/) |
| Pinia | 去除 mutations 的状态管理如何实现？ | [pinia](pinia/) |

## P0 资产

| 资产 | 目录 | 状态 |
|------|------|------|
| Proxy 响应式手写 | `reactivity/` | skeleton |
| effect + scheduler 手写 | `effect-scheduler/` | skeleton |
| Vue rendering performance playbook | `performance/` | todo |
| Pinia 简化实现 | `pinia/` | todo |