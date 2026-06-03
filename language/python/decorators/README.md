# 装饰器与闭包层

这一层训练函数是一等对象、闭包和横切逻辑抽象。后端代码里的日志、权限、缓存、重试、事务、限流都适合用这一层的题来练。

## 必会概念

- 闭包捕获变量绑定，不是拷贝一份值。
- 装饰器本质是函数包装函数。
- 带参数装饰器通常是三层函数。
- `functools.wraps` 用来保留原函数元信息。
- 同步函数和异步函数的包装方式不同。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| 手写 `timer` | `timer.py` | todo | 包装函数、返回值、异常透明 |
| 手写 `retry` | `retry.py` | todo | 重试次数、异常传播、延迟 |
| 手写 `memoize` | `memoize.py` | todo | 参数哈希、缓存命中 |
| 手写 `once` | `once.py` | todo | 闭包状态 |
| 手写 `rate_limit` | `rate_limit.py` | todo | 时间窗口、并发边界 |
| 手写 async-aware decorator | `async_aware.py` | todo | `inspect.iscoroutinefunction` |
