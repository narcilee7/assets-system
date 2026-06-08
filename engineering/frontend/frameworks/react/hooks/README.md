# React Hooks（手写 Hooks）

## 问题描述

手写简化版 React Hooks，理解 hooks 的核心机制。

### 核心概念

- **Hooks 链表**：每个组件实例有自己的 hooks 链表
- **Dispatcher**：根据组件类型（Hooks/Future）分发到不同实现
- **Update Queue**：批量处理 setState，避免多次 render
- **Lazy Initialization**：initial value 支持函数（惰性求值）

### 目标

```ts
// 手写 useState，理解：
// 1. 闭包如何保存状态？
// 2. dispatch 为何是稳定的（始终是同一个函数）？
// 3. batching 如何工作？
// 4. 函数式更新如何实现？
```

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证 useState 行为
```

## 追问

- `useState` 的初始值为什么支持函数形式？
- `dispatch` 为什么在任何时候都是同一个函数引用？
- 如果在 `useState` 的 initial function 中抛出异常，React 如何处理？
- `useReducer` 和 `useState` 的本质区别是什么？