# Fiber（纤程）

## 问题描述

实现一个简化版 Fiber 架构，理解 React 16+ 的 render 机制。

### 核心概念

- **Fiber Node**：每个 React 元素对应一个 Fiber node，形成 fiber tree。
- **Work Loop**：遍历 fiber tree，处理每个节点的 work（create/update/delete）。
- **Render Phase**：可中断的遍历阶段，收集变更。
- **Commit Phase**：不可中断的执行阶段，将变更应用到 DOM。
- **双缓冲**：workInProgress tree 和 current tree 的切换。

### 目标

```ts
// 手写一个简化版 React 的 render 流程
// 1. 将 JSX 转换为 fiber node
// 2. 构建 fiber tree
// 3. 实现 workLoop（处理完所有 work 才退出）
// 4. 实现 commitRoot（将变更提交到 DOM）
```

## 约束

- 不使用真实 React，用 TypeScript 模拟。
- 单线程模拟（没有真正的 interrupt/yield）。
- 支持函数组件和类组件（简化版）。
- 支持 useState（简化版 dispatch）。

## 手写提示

1. Fiber node 结构：`{ type, props, child, sibling, return, dom, effectTag, alternate }`
2. `render(lazyRoot)` 创建 workInProgress root，调度 work
3. `workLoop(deadline)` 遍历所有 fiber，调用 `performUnitOfWork`
4. `performUnitOfWork` 做三件事：1) 创建 DOM 2) 收集 children 3) 返回 next fiber
5. `commitRoot` 遍历 fiber tree，依次挂载 DOM

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证 fiber 渲染
```