# Engineering Patterns

这一层训练用 TypeScript 类型系统表达工程模式的能力：显式错误处理、类型安全事件系统、中间件链、Repository、DI 容器。

## 必会概念

- Result / Either 模式用类型替代 throw，强制处理失败路径。
- 类型安全事件系统通过映射类型约束事件名和载荷类型。
- Middleware 链的类型需要递归或折叠来保持上下文类型。
- DI 容器的类型需要在编译期解析依赖图。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 显式错误建模 | `result/` | ready | Result<T,E>、map、andThen、unwrapOr |
| 类型安全事件系统 | `typed-event-emitter/` | ready | 事件映射、on/off/emit/once |
| 中间件类型链 | `middleware-chain/` | todo | 洋葱模型、上下文类型传递 |
| Repository 模式 | `repository-pattern/` | todo | 接口抽象、泛型约束 |
| DI 容器类型 | `di-container/` | todo | 依赖图解析、生命周期类型 |
