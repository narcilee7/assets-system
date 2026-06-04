# Result

## 目标

实现一个 `Result<T, E>` 类型，用类型系统显式表达操作可能成功或失败，替代隐式的 `throw` 和 `try/catch`。

## 题目 / 场景

在 API 调用、文件解析、数据转换等可能失败的场景中，调用方必须在编译期处理失败路径，而不是在运行时 catch 异常。

## 核心考点

- 代数数据类型（ADT）：`Ok<T>` 和 `Err<E>` 的联合。
- 链式操作：`map`、`mapErr`、`andThen` 的短路语义。
- 类型收窄：通过 `isOk()` / `isErr()` 守卫区分变体。

## 边界条件

- `unwrap` 在 Err 上调用时应抛出，生产环境应避免直接使用。
- `andThen` 的嵌套：连续多个可能失败的操作如何优雅组合。
- 同步和异步 Result：如何与 Promise 结合（`ResultAsync` 扩展）。

## 实现思路

1. 定义 `Result<T, E>` 为 `Ok<T> | Err<E>`。
2. `Ok` 和 `Err` 实现相同的接口，提供 `map`、`mapErr`、`andThen`、`unwrapOr`。
3. `andThen` 仅在 `Ok` 时执行回调，`mapErr` 仅在 `Err` 时执行回调。

## 复杂度

- 时间复杂度：O(1) 每次操作。
- 空间复杂度：O(1)。

## 面试追问

- 如果和 async/await 结合，如何设计 `ResultAsync` 避免嵌套回调？
- 如果错误类型也是联合类型，如何在链式调用中保持精确的错误类型？
- 和 Go 的 `(value, error)` 多返回值相比，Result 模式的优势是什么？

## 工程迁移

- API 层统一返回 `Result<T, ApiError>`，业务层通过 `match` 或 `andThen` 处理。
- 在函数式编程风格的数据管道中（如解析 → 校验 → 转换），Result 的链式调用比 try/catch 更清晰。
