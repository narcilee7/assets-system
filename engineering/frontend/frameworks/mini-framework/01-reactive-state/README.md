# 01 Reactive State（响应式状态）

## 问题描述

实现一个简单的响应式状态系统，类似 MobX 或 Vue 的响应式基础。

### 核心 API

```ts
const state = reactive({ count: 0, name: "Alice" })

// 读取自动收集依赖
effect(() => {
  console.log(`count is ${state.count}`)
})

// 修改触发更新
state.count++ // → 打印 "count is 1"
state.name = "Bob" // → 打印 "count is 1"（name 改变不影响 count）
```

### 核心概念

- **observe**：将普通对象转换为响应式代理。
- **notify**：状态变化时通知订阅者。
- **subscriber / effect**：订阅状态变化的回调函数。
- **依赖收集（Dependency Collection）**：在 effect 执行时自动收集依赖。

## 约束

- 使用 `Proxy` 实现 observe（不修改原对象）。
- 每个 key 的订阅者列表独立管理。
- effect 执行时读取的 key 会自动订阅。
- 支持嵌套对象的响应式（深层 observe）。

## 手写提示

1. 用 `WeakMap<object, Map<key, Set<effect>>>` 存储依赖图。
2. `createEffect` 需要在执行前建立 "正在执行 effect" 的标记。
3. 读取属性时：如果当前有 activeEffect，订阅该 key。
4. 写入属性时：如果有 activeEffect 的 target，通知该 key 的订阅者。

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证响应式行为
```

## 追问

- 如果 effect 内有条件分支（`if (state.show) { console.log(state.count) }`），依赖收集会发生什么？
- 嵌套对象（如 `state.address.city`）的依赖收集如何工作？
- 如何避免 effect 之间的循环依赖？
- 如果在 effect 执行期间再次触发同一 effect，会发生什么？