# Review

## 我一开始容易写错什么

1. **andThen 的返回类型**：一开始在 `Ok` 的 `andThen` 中返回了 `Result<U, E | E2>`，实际上如果当前是 Ok，说明没有错误，返回的 Result 的错误类型直接由回调决定即可。
2. **unwrapOr 的类型参数**：`Err.unwrapOr` 需要接收一个默认值的类型 `T`，但类本身没有 `T`，需要把方法做成泛型方法。
3. **fromThrowable 的类型推导**：一开始没有给 `onError` 默认实现，导致必须显式传第二个参数才能正确推导错误类型。

## 这个实现为什么成立

- `Ok` 和 `Err` 实现对称的接口，通过 `ok` / `err` 标志属性进行类型收窄。
- `andThen` 提供了 Monad 风格的绑定，支持链式组合多个可能失败的操作。
- `match` 强制调用方同时处理成功和失败路径，避免遗漏。

## 和标准库 / 框架实现的差距

- neverthrow 是 TypeScript 中最流行的 Result 库，提供了更完整的 `ResultAsync`、组合子（`combine`、`safeJsonParse` 等）和更好的类型推导。
- Rust 的 `Result` 是语言内置，支持 `?` 操作符自动传播错误，TS 中只能通过链式调用模拟。

## 工程里怎么取舍

- 在团队接受函数式风格的前提下，Result 模式比 try/catch 更清晰，尤其是在需要链式组合多个可能失败操作时。
- 如果团队主要使用 async/await，可以结合 `fromPromise` 在异步边界引入 Result，内部继续使用 async/await。
- 不要试图完全替换所有异常，对于真正的不可恢复错误（如内存耗尽），仍然应该 throw。

## 下次复习重点

1. 手写 `andThen` 时记住短路语义：Err 直接透传，Ok 执行回调。
2. 思考如何实现 `combine(results: Result<T, E>[]): Result<T[], E>`。
3. 对比 Rust 的 `?` 和 TS 中 `await` + Result 的等价写法。
