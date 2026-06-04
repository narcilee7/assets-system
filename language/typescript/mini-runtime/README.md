# Mini Runtime

这一层把零散的类型机制组合成框架级理解：手写 Promise、手写 Redux、手写 Router。

## 必会概念

- Promise 是状态机：pending → fulfilled / rejected，不可逆。
- Redux 的核心是单一状态树 + 纯函数 reducer + 不可变更新。
- Router 的类型挑战在于从路径模板中提取参数类型。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 手写 Promise 状态机 | `cpromise/` | ready | thenable 展开、微任务、组合 API |
| 手写 Redux + 类型推导 | `mini-redux/` | todo | Action 类型、Reducer 类型、Store 类型 |
| 手写 Router + 参数提取 | `mini-router/` | todo | 路径模板、参数类型推导 |
