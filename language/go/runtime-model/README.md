# Go Runtime Model

这一层训练 Go 的底层直觉：值语义、指针、slice、map、defer、逃逸分析和基本内存行为。

## 必会概念

- Go 默认按值传递，slice / map / channel 的值本身是描述符。
- slice append 可能复用底层数组，也可能触发扩容。
- map 不是并发安全结构。
- method receiver 分 value receiver 和 pointer receiver。
- defer 在函数返回前按后进先出执行。
- 逃逸分析决定变量是否需要分配到堆上。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| slice append 扩容实验 | `slice_append/` | todo | len、cap、底层数组共享 |
| map 计数器并发风险 | `map_counter/` | todo | map 非并发安全、sync.Map / mutex |
| value receiver vs pointer receiver | `receiver/` | todo | 拷贝、修改、method set |
| defer 执行顺序 | `defer_order/` | todo | LIFO、命名返回值 |
| 逃逸分析示例 | `escape_analysis/` | todo | `go build -gcflags=-m` |

