# RSC (React Server Components)

## 问题描述

理解 RSC 的核心原理：client/server boundary 划分、props 序列化限制、streaming 机制。

### 核心概念

- **Server Component**：在服务器渲染，可直接访问后端资源（DB、文件系统），不能使用 hooks/浏览器 API
- **Client Component**：在浏览器渲染，可使用所有 React 特性
- **Boundary**：`<Suspense>` 和 `"use client"` 指令定义的边界
- **Props 序列化**：RSC 间传递的 props 必须可序列化（函数不能直接传递）

### 关键问题

1. **为什么 Server Component 的 props 必须可序列化？**
   → 因为 props 需要从服务器传到浏览器

2. **Server Component 如何与 Client Component 通信？**
   → 通过 props（children 插槽模式）和 Server Action

3. **Suspense 如何实现 streaming？**
   → 服务器先返回 shell，pending 时显示 fallback，数据好后替换

## 约束

- 实现一个简化版 RSC 渲染器
- 支持 Server Component 和 Client Component 的区分
- 支持 children 插槽模式（组件组合）
- 模拟 props 序列化/反序列化

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证 RSC 行为
```

## 追问

- 为什么 `useState` 不能在 Server Component 中使用？
- Server Component 的数据如何被 Client Component 使用？
- `"use client"` 指令的实际作用是什么？
- RSC 如何处理 error boundary？
- streaming 和 SSR 的本质区别是什么？