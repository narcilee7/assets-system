# Goroutine 与 Channel：从语言规范到工程直觉

> Go 的并发不是"库"，而是语言本身。理解 `go`、`chan`、`select` 这三个语法构造的完整语义，是掌握 Go 并发的第一步。

---

## 1. 设计哲学：为什么不是线程 + 锁

Go 的设计者认为：

- **线程模型太复杂**：线程创建成本高、调度由内核决定、锁的粒度难以把握。
- **共享内存容易错**：`mutex` + `condition variable` 的组合极易导致死锁和竞争。
- **消息传递更自然**：CSP（Communicating Sequential Processes）模型中，进程通过**显式通信**共享数据，而非通过**共享内存**隐式同步。

Go 的选择：
- **goroutine**：极轻量（初始栈 2KB），由 Go 运行时调度，百万级并发无压力。
- **channel**：类型安全的管道，是 goroutine 之间通信和同步的**首选机制**。
- **正交设计**：goroutine 和 channel 各自独立。你可以启动 goroutine 不用 channel；也可以用 channel 在同一线程内通信。

> **关键直觉**：在 Go 中，**不要通过共享内存来通信；要通过通信来共享内存**（Share memory by communicating, don't communicate by sharing memory）。这不是绝对的——`sync.Mutex` 依然存在——但它是默认心智模型。

---

## 2. Goroutine：轻量、独立、无返回值

### 2.1 基本语法

```go
go func() {
    fmt.Println("running in goroutine")
}()
```

- `go` 是**语句**，不是表达式，**没有返回值**。
- `go` 语句**立即返回**，调用者不会等待 goroutine 完成。
- goroutine 内的 `panic` **不会传播**到调用者，只会导致该 goroutine 崩溃。

### 2.2 闭包陷阱：循环变量

这是 Go 并发面试最高频的陷阱。

**Go 1.21 及之前（错误示例）**：

```go
for _, item := range []string{"a", "b", "c"} {
    go func() {
        fmt.Println(item) // ❌ 三个 goroutine 共享同一个 item 变量
    }()
}
// 输出: c c c（大概率，顺序不定）
```

**修复方式**：

```go
// 方式一：传参（推荐）
for _, item := range []string{"a", "b", "c"} {
    go func(v string) {
        fmt.Println(v)
    }(item)
}

// 方式二：局部拷贝
for _, item := range []string{"a", "b", "c"} {
    item := item // 创建新的局部变量
    go func() {
        fmt.Println(item)
    }()
}
```

**Go 1.22+**：循环变量改为 per-iteration 语义，每次迭代自动创建新实例，上述错误代码**默认正确**。但这是语言演进，面试仍需知道旧行为。

### 2.3 闭包陷阱：没有同步就返回

```go
func bad() int {
    result := 0
    go func() {
        result = compute() // 可能主 goroutine 已经返回了
    }()
    return result // ❌ 几乎一定是 0
}
```

**规则**：如果你需要 goroutine 的计算结果，必须用 `channel`、`sync.WaitGroup` 或其他同步机制等待。

### 2.4 `go` 之前的操作 happens-before goroutine 内

```go
var msg string
msg = "hello"
go func() {
    fmt.Println(msg) // ✅ 保证打印 "hello"
}()
```

这是 Go 内存模型的一部分：`go` 语句启动 goroutine 之前对变量的写，对 goroutine 内是可见的。

---

## 3. Channel：类型安全的通信原语

### 3.1 创建与类型

```go
ch := make(chan int)        // 无缓冲 channel（同步）
ch := make(chan int, 10)    // 有缓冲 channel（异步，容量 10）
```

- channel 是**引用类型**，零值为 `nil`。
- `nil channel` 的发送和接收都会**永久阻塞**（不会 panic，但程序会卡住）。

### 3.2 核心操作语义

| 操作 | 未关闭 | 已关闭 | nil |
|------|--------|--------|-----|
| 发送 `ch <- v` | 阻塞直到有接收者 / 写入缓冲 | **panic** | 永久阻塞 |
| 接收 `v := <-ch` | 阻塞直到有发送者 / 从缓冲读 | 立即返回零值，`ok=false` | 永久阻塞 |
| 关闭 `close(ch)` | 关闭成功，通知所有接收者 | **panic** | **panic** |

**关键规则**：
- 向**已关闭**的 channel 发送数据 → **panic**。
- 从**已关闭**的 channel 接收 → 立即返回零值，`ok` 为 `false`。
- **关闭 nil channel → panic**。
- **重复关闭 channel → panic**。

### 3.3 检测关闭

```go
v, ok := <-ch
if !ok {
    // channel 已关闭，且没有更多数据
}
```

### 3.4 `for range` 遍历 channel

```go
for v := range ch {
    fmt.Println(v)
}
// 循环在 channel 关闭且缓冲区读完后自动退出
```

**重要**：`for range` 会在 channel 关闭且所有数据被消费后退出。如果发送者没有关闭 channel，`for range` 会永久阻塞。

### 3.5 方向约束

```go
func sendOnly(ch chan<- int)      // 只能发送
func recvOnly(ch <-chan int) int  // 只能接收
func bidirectional(ch chan int)   // 双向
```

方向约束是**编译时检查**，不是运行时。这是 Go 类型系统的一部分，用于表达 API 意图。

**转换规则**：
- 双向 channel 可以隐式转为只发送或只接收。
- 只发送 / 只接收**不能**转回双向。

---

## 4. Select：多路等待与随机选择

### 4.1 基本语法

```go
select {
case v := <-ch1:
    fmt.Println("received", v)
case ch2 <- 42:
    fmt.Println("sent 42")
case <-time.After(5 * time.Second):
    fmt.Println("timeout")
default:
    fmt.Println("no channel ready")
}
```

### 4.2 核心语义

1. **随机公平**：多个 case 同时就绪时，`select`**伪随机**选择一个执行。防止某个 channel 长期饥饿。
2. **default**：有 `default` 时，`select` 是非阻塞的；没有时，会挂起等待直到某个 case 就绪。
3. **nil channel**：`select` 中某个 case 的 channel 是 `nil`，该 case**永远不会被选中**。这可以用于**动态禁用**某个分支：

```go
var ch chan int // nil
for {
    select {
    case v := <-ch:
        // 永远不会执行，直到 ch 被赋值
        fmt.Println(v)
    case <-done:
        return
    }
}
```

### 4.3 `time.After` 泄漏陷阱

```go
// ❌ 错误：每次循环创建新 timer，旧的不会释放
for {
    select {
    case v := <-ch:
        fmt.Println(v)
    case <-time.After(5 * time.Second):
        fmt.Println("timeout")
    }
}
```

```go
// ✅ 正确：使用单一 timer 或 time.NewTimer
timer := time.NewTimer(5 * time.Second)
defer timer.Stop()
for {
    timer.Reset(5 * time.Second)
    select {
    case v := <-ch:
        fmt.Println(v)
    case <-timer.C:
        fmt.Println("timeout")
    }
}
```

---

## 5. 关闭 Channel 的原则

这是 Go 并发中最容易引发争论的话题。语言规范没有强制规定谁关闭，但工程上有**明确的最佳实践**：

### 5.1 核心原则

> **发送者关闭，或者由某个协调者关闭。接收者永远不要关闭。**

原因：
- 发送者知道自己什么时候发完，关闭是自然信号。
- 接收者不知道发送者是否还会发送，如果接收者关闭了 channel，而发送者还在发送 → **panic**。
- 多个发送者时，需要额外同步（`sync.Once` 或额外协调 channel）来决定谁关闭。

### 5.2 多发送者的关闭方案

```go
// 方案一：sync.Once
var once sync.Once
closeCh := func() { once.Do(func() { close(ch) }) }
// 每个发送者发完后调用 closeCh()

// 方案二：引入 done 信号 channel
// 由协调 goroutine 监听 done，然后关闭数据 channel
```

### 5.3 不需要关闭的情况

如果 channel 的生命周期与程序相同，或者由 GC 管理，**不关闭也完全没问题**。channel 会在没有任何 goroutine 引用时被 GC 回收。

---

## 6. 常见模式（语言层面的惯用法）

### 6.1 等待一组 goroutine：`sync.WaitGroup`

```go
var wg sync.WaitGroup
for _, task := range tasks {
    wg.Add(1)
    go func(t Task) {
        defer wg.Done()
        process(t)
    }(task)
}
wg.Wait()
```

**注意**：`wg.Add(1)` 必须在启动 goroutine**之前**调用，否则可能 `wg.Wait()` 在 `Add` 之前就返回了。

### 6.2 限制并发度：缓冲 channel 作为信号量

```go
sem := make(chan struct{}, 3) // 最大并发 3
for _, task := range tasks {
    sem <- struct{}{} // 获取信号量
    go func(t Task) {
        defer func() { <-sem }() // 释放
        process(t)
    }(task)
}
// 等待全部完成：填满信号量
for i := 0; i < cap(sem); i++ {
    sem <- struct{}{}
}
```

### 6.3 Pipeline（管道）

```go
// stage 1: 生成数据
func gen(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for _, n := range nums {
            out <- n
        }
    }()
    return out
}

// stage 2: 处理数据
func sq(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for n := range in {
            out <- n * n
        }
    }()
    return out
}

// 使用
for n := range sq(gen(2, 3, 4)) {
    fmt.Println(n) // 4, 9, 16
}
```

### 6.4 Fan-out / Fan-in

```go
// Fan-out：多个 worker 消费同一个 input
func fanOut(in <-chan int, n int) []<-chan int {
    outs := make([]<-chan int, n)
    for i := 0; i < n; i++ {
        outs[i] = sq(in) // 每个 worker 一个 output channel
    }
    return outs
}

// Fan-in：合并多个 channel
func fanIn(channels ...<-chan int) <-chan int {
    out := make(chan int)
    var wg sync.WaitGroup
    wg.Add(len(channels))
    for _, ch := range channels {
        go func(c <-chan int) {
            defer wg.Done()
            for v := range c {
                out <- v
            }
        }(ch)
    }
    go func() {
        wg.Wait()
        close(out)
    }()
    return out
}
```

---

## 7. 常见陷阱

### 7.1 死锁：所有 goroutine 都在阻塞

```go
func main() {
    ch := make(chan int)
    ch <- 1 // ❌ 没有接收者，main 永远阻塞 → fatal error: all goroutines are asleep - deadlock!
    fmt.Println(<-ch)
}
```

### 7.2 向已关闭 channel 发送

```go
close(ch)
ch <- 1 // ❌ panic: send on closed channel
```

### 7.3 重复关闭

```go
close(ch)
close(ch) // ❌ panic: close of closed channel
```

### 7.4 Goroutine 泄漏：channel 永久阻塞

```go
func leaky() {
    ch := make(chan int)
    go func() {
        <-ch // 永远等不到数据
    }()
    // ch 永远不会被写入，goroutine 永久阻塞但不会被 GC
}
```

### 7.5 `select` 中忘记 `default` 导致意外阻塞

```go
select {
case v := <-ch:
    fmt.Println(v)
}
// 如果没有 default，且 ch 没有数据，这里会永久阻塞
```

---

## 8. 与深层章节的关联

| 本章概念 | 深入方向 |
|---------|---------|
| goroutine 轻量线程 | → `../03-memory-and-runtime/` GMP 调度模型、栈增长与分裂 |
| channel 实现 | → `../04-concurrency-in-depth/` channel 的 ring buffer、sendq/recvq、锁实现 |
| `go` happens-before | → `../03-memory-and-runtime/` Go 内存模型、happens-before 规则 |
| select 随机选择 | → `../04-concurrency-in-depth/` select 的编译器转换、多路轮询实现 |
| panic / recover 与 goroutine | → `../04-concurrency-in-depth/` 跨 goroutine panic 传播、错误处理模式 |

---

## 9. 一句话 checklist

- [ ] `go` 启动的 goroutine 有没有可能永远等不到数据？→ 检查泄漏。
- [ ] `close(ch)` 是谁执行的？→ 确保发送者关闭，接收者不关闭。
- [ ] `for range ch` 的退出条件是什么？→ 确保发送者最终会关闭。
- [ ] `select` 有没有 `default`？→ 确认是否需要阻塞等待。
- [ ] 循环里启动 goroutine 有没有传参？→ 避免闭包变量陷阱。
