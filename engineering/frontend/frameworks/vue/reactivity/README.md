# Vue Reactivity（响应式原理）

## 问题描述

手写 Vue 3 响应式系统的核心部分，理解 Proxy 拦截、依赖收集、触发更新的完整链路。

### 核心 API

```ts
const state = reactive({ count: 0, name: 'Alice' })

// 读取自动收集依赖
effect(() => {
  console.log(`count is ${state.count}`)
})

// 修改触发更新
state.count++ // → 打印 "count is 1"
state.name = 'Bob' // → 不触发（name 不在依赖中）
```

### 核心概念

- **Proxy 拦截**：`get` 拦截读，`set` 拦截写
- **依赖收集（track）**：effect 执行时访问的 key，自动订阅
- **触发更新（trigger）**：key 变化时通知所有订阅的 effect
- **嵌套对象**：深层响应式，递归包装
- **数组**：索引访问和 length 修改的处理

## 约束

- 使用 `Proxy` + `Reflect` 实现
- 依赖图结构：`WeakMap<target, Map<key, Set<effect>>>`
- effect 执行期间用 `activeEffect` 标记当前正在执行的 effect
- 支持 `isReactive`、`isRef`、`toRaw` 等工具函数

## 手写提示

1. `track(target, key)`：如果 `activeEffect` 存在，将当前 effect 加入 `target[key]` 的订阅者列表
2. `trigger(target, key)`：获取 `target[key]` 的所有 effect，依次执行
3. `reactive(obj)`：返回 `new Proxy(obj, { get, set })`，深层递归包装对象
4. `effect(fn)`：设置 `activeEffect = fn`，执行 `fn()`，恢复 `activeEffect = null`

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证响应式行为
```

## 追问

- 为什么 Vue3 选择 Proxy 而不是 Object.defineProperty？
- `isRef`、`toRef`、`unref` 如何实现？
- `computed` 的 effect 是惰性订阅还是即时订阅？
- `watchEffect` 和 `watch` 的区别是什么？