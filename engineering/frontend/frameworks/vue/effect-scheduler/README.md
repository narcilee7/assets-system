# Effect Scheduler（调度机制）

## 问题描述

手写 Vue 的 effect 调度机制，理解 scheduler 如何控制 effect 执行时机。

### 核心概念

- **Job Queue**：Vue 3 用 Promise 微任务队列调度 effect
- **Scheduler**：决定 effect 何时执行（同步/异步/批量）
- **flushing**：flushJob 从 queue 中取出 job 执行
- **pre**：优先级更高的 job（如 beforeMount、beforeUpdate）

### 关键 API

```ts
effect(() => { ... }, { 
  scheduler: (job) => { queueJob(job) }, // 自定义调度
  flush: 'pre' | 'post' | 'sync'         // 执行时机
})
```

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证调度行为
```