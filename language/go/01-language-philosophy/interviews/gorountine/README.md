# Goroutine + Channel 面试题集 — 并发核心

---

## Level 1：GMP 调度与 Goroutine 生命周期（3 题）

### 题 1：GMP 模型与调度策略

**问题**：简述 G、M、P 的关系。如果 `GOMAXPROCS=4`，程序中有 100 个 Goroutine，描述调度过程。`M` 和 `P` 的数量一定相等吗？什么情况下 `M` 会多于 `P`？

<details>
<summary>答案与解析</summary>

**G（Goroutine）**：用户态轻量线程，初始栈 2KB，由 Go 运行时管理。

**M（Machine）**：OS 线程，由操作系统调度。M 必须绑定 P 才能执行 G。

**P（Processor）**：逻辑处理器，维护本地可运行 G 队列（runq，长度 256）。P 的数量默认等于 CPU 核心数。

**调度过程**：
1. 100 个 G 被创建后，放入 P 的本地 runq 或全局 runq。
2. 4 个 P 各自绑定一个 M，从本地 runq 取出 G 执行。
3. 如果某个 P 的本地队列空了，从**全局队列**取（加锁），或从其他 P **偷取**（work stealing，偷一半）。

**M > P 的情况**：
- 当 G 发生**阻塞式系统调用**（如文件 IO、网络阻塞在无法 netpoll 的场景），M 会释放 P（handoff），去阻塞等待。此时需要新建 M 来执行其他 G，导致 M 数量 > P。
- 当使用 `runtime.LockOSThread()`，G 独占一个 M，该 M 不绑定 P。

**考点**：P 是调度单元，M 是执行载体。阻塞导致 M 膨胀，但 P 不变。

</details>

---

### 题 2：Goroutine 栈与抢占

```go
func deep(n int) {
    if n <= 0 {
        return
    }
    var buf [1024]byte
    _ = buf
    deep(n - 1)
}

func main() {
    go deep(100000)
    time.Sleep(time.Second)
}
```

**问题**：这段代码会栈溢出吗？Go 的栈增长机制是什么？Go 1.14 前后的抢占机制有何不同？

<details>
<summary>答案与解析</summary>

**答案**：不会栈溢出。Go 使用**连续栈（Contiguous Stack）**，按需扩容。

**解析**：

**栈增长机制**：
- **Go 1.2-1.3**：分段栈（Segmented Stack）。栈满时分配新段，用链表连接。问题是"热分裂"（频繁在边界调用导致频繁扩缩容）。
- **Go 1.4+**：连续栈。栈满时分配更大的连续内存（2x 扩容），复制旧栈数据，调整指针。无碎片问题。

**栈大小**：
- 初始 2KB（64 位系统）。
- 最大 1GB（64 位）。

**抢占机制**：
- **Go 1.13 及之前**：协作式抢占。Goroutine 在**函数调用时**检查栈边界，如果应该被抢占，主动让出。问题是纯计算循环（无函数调用）无法被抢占。
- **Go 1.14+**：基于信号的抢占（`SIGURG`）。`sysmon` 监控，发现运行超过 10ms 的 G，发送信号，在信号处理函数中设置抢占标记，强制让出。

**考点**：连续栈的复制成本、信号抢占的延迟（~1ms 内）。

</details>

---

### 题 3：Goroutine 泄漏检测

```go
func process() {
    ch := make(chan int)
    go func() {
        // 耗时操作
        time.Sleep(10 * time.Second)
        ch <- 1
    }()
    // 函数返回，ch 无人接收
}
```

**问题**：这段代码有什么问题？如何检测 Goroutine 泄漏？`pprof` 的 `goroutine` 和 `threadcreate` 有什么区别？

<details>
<summary>答案与解析</summary>

**答案**：**Goroutine 泄漏**。`ch` 是无缓冲 channel，发送方阻塞，但 `process` 已返回，无人接收。

**解析**：

**泄漏原因**：
- Goroutine 永远阻塞在 `ch <- 1`，无法退出。
- 每次调用 `process` 泄漏一个 G，内存持续增长。

**修复**：
```go
func process() {
    ch := make(chan int, 1)  // 缓冲 1，发送不阻塞
    go func() {
        time.Sleep(10 * time.Second)
        ch <- 1
    }()
    // 或：确保函数等待或取消
}
```

**检测手段**：
1. **`runtime.NumGoroutine()`**：监控 G 数量。
2. **`pprof` / `debug` 包**：
   ```go
   import _ "net/http/pprof"
   // 访问 /debug/pprof/goroutine?debug=1
   ```
3. **单元测试**：`go.uber.org/goleak` 库。
   ```go
   defer goleak.VerifyNone(t)
   ```

**goroutine vs threadcreate**：
- `goroutine`：当前所有 G 的堆栈信息。
- `threadcreate`：运行时创建的 OS 线程（M）信息，用于诊断 M 膨胀。

**考点**：channel 缓冲设计、超时控制、context 取消。

</details>

---

## Level 2：Channel 底层与语义（4 题）

### 题 4：hchan 结构与 send/recv 路径

**问题**：`make(chan int, 3)` 的底层结构是什么？向已满 channel 发送、向空 channel 接收时，Goroutine 会发生什么？`sendq` 和 `recvq` 是什么队列？

<details>
<summary>答案与解析</summary>

**答案**：底层是 `runtime.hchan` 结构。

**解析**：

```go
type hchan struct {
    qcount   uint           // 当前元素个数
    dataqsiz uint           // 环形队列大小（缓冲容量）
    buf      unsafe.Pointer // 环形队列指针
    elemsize uint16         // 元素大小
    closed   uint32          // 关闭标志
    elemtype *_type         // 元素类型
    sendx    uint           // 发送索引
    recvx    uint           // 接收索引
    recvq    waitq          // 等待接收的 G 队列
    sendq    waitq          // 等待发送的 G 队列
    lock     mutex          // 互斥锁
}
```

**发送路径**：
1. 加锁。
2. 如果有等待接收的 G（`recvq` 非空），直接把数据拷贝给接收 G，唤醒它（**无缓冲直接交换**）。
3. 如果缓冲未满，写入 `buf` 环形队列，`sendx++`。
4. 如果缓冲已满，当前 G 打包成 `sudog` 放入 `sendq`，挂起等待。

**接收路径**：
1. 加锁。
2. 如果有等待发送的 G（`sendq` 非空），直接从发送 G 拷贝数据（**无缓冲直接交换**）。
3. 如果缓冲非空，从 `buf` 读取，`recvx++`。
4. 如果缓冲为空且未关闭，当前 G 放入 `recvq`，挂起。

**考点**：channel 操作是**加锁 + 环形队列 + 等待队列**，不是无锁结构。

</details>

---

### 题 5：关闭 Channel 的语义与广播

```go
ch := make(chan int)
close(ch)

v, ok := <-ch       // ok = ?
ch <- 1             // panic？
close(ch)           // panic？

// 多接收者场景
var wg sync.WaitGroup
for i := 0; i < 3; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        for v := range ch {
            fmt.Println(v)
        }
    }()
}
close(ch)
wg.Wait()
```

**问题**：关闭后发送/重复关闭会怎样？`range` 如何感知关闭？为什么关闭 channel 能实现广播？`close` 的 happens-before 语义？

<details>
<summary>答案与解析</summary>

**答案**：
- `v, ok := <-ch`：`v=0, ok=false`（零值 + false）
- `ch <- 1`：**panic**：`send on closed channel`
- `close(ch)`：**panic**：`close of closed channel`

**解析**：

**广播机制**：
- `close(ch)` 会唤醒 `recvq` 中**所有**等待的 G。
- 被唤醒的 G 发现 `closed=1`，直接返回零值 + `ok=false`。
- 这是 Go 中**唯一**能同时唤醒多个等待者的机制（类似 `condition variable`）。

**range 感知**：
- `for v := range ch` 等价于：
  ```go
  for {
      v, ok := <-ch
      if !ok { break }
      // body
  }
  ```

**Happens-Before**：
- `close(ch)` happens-before 任何从该 channel 的接收操作返回（`ok=false`）。
- 这意味着可以用 `close` 做**同步信号**：
  ```go
  done := make(chan struct{})
  go func() {
      // work
      close(done)
  }()
  <-done  // 保证看到 worker 的所有写入
  ```

**考点**：关闭是广播信号，不是数据。只能由发送方关闭。

</details>

---

### 题 6：Select 的编译与运行时

```go
select {
case v := <-ch1:
    fmt.Println("ch1", v)
case ch2 <- 1:
    fmt.Println("ch2 sent")
case <-time.After(500 * time.Millisecond):
    fmt.Println("timeout")
default:
    fmt.Println("default")
}
```

**问题**：`select` 是如何实现的？多个 case 同时 ready 时如何保证公平？`default` 分支的作用？`time.After` 的内存泄漏风险？

<details>
<summary>答案与解析</summary>

**答案**：

**编译期**：
- `select` 被编译器转换为对 `runtime.selectgo` 的调用。
- 生成 `scase` 数组，记录每个 case 的 channel 和方向（send/recv）。

**运行时**：
1. **轮询顺序随机化**：用 `runtime.fastrand` 生成随机轮询顺序，遍历所有 case。
2. 如果找到 ready 的 case，执行并返回。
3. 如果没有 ready 的 case 且无 `default`，当前 G 加入所有相关 channel 的等待队列（`sendq`/`recvq`），挂起。
4. 被唤醒时，从所有 channel 的等待队列中移除自己（防止泄漏）。

**公平性**：
- 轮询顺序随机，防止某个 channel 饥饿。

**default**：
- 使 select 变为**非阻塞**。如果没有 ready 的 case，立即执行 default。

**time.After 泄漏**：
- `time.After` 返回新 channel，由后台 timer goroutine 在超时后发送。
- 如果 select 因其他 case 提前返回，timer 仍在运行，channel 无人接收，**timer goroutine 泄漏**。
- **修复**：
  ```go
  timer := time.NewTimer(500 * time.Millisecond)
  defer timer.Stop()
  select {
  case <-ch1:
  case <-timer.C:
  }
  ```

**考点**：select 不是轮询，是**注册 + 等待**。`time.After` 有泄漏风险。

</details>

---

## Level 3：并发模式（4 题）

### 题 7：Pipeline 模式

```go
func gen(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums {
            out <- n
        }
        close(out)
    }()
    return out
}

func sq(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- n * n
        }
        close(out)
    }()
    return out
}
```

**问题**：这个 Pipeline 有什么问题？如何支持**优雅退出**（上游取消时下游立即停止）？如何防止 goroutine 泄漏？

<details>
<summary>答案与解析</summary>

**答案**：没有取消机制，如果下游不再消费，上游 goroutine 会永久阻塞泄漏。

**修复（Context 取消）**：
```go
func gen(ctx context.Context, nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for _, n := range nums {
            select {
            case out <- n:
            case <-ctx.Done():
                return
            }
        }
    }()
    return out
}

func sq(ctx context.Context, in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for n := range in {
            select {
            case out <- n * n:
            case <-ctx.Done():
                return
            }
        }
    }()
    return out
}

// 使用
ctx, cancel := context.WithCancel(context.Background())
defer cancel()
for n := range sq(ctx, gen(ctx, 2, 3, 4)) {
    if n > 10 {
        break  // cancel 传播，所有 goroutine 退出
    }
}
```

**考点**：Pipeline 必须有**取消传播**，否则 break 后泄漏。

</details>

---

### 题 8：Worker Pool 模式

**要求**：实现一个 Worker Pool，支持：
- 固定数量的 worker
- 任务队列
- 优雅退出（处理完已接收任务后停止）
- 错误返回

```go
type Task struct {
    ID int
    Fn func() error
}

type Pool struct { ... }
func NewPool(workers int) *Pool
func (p *Pool) Submit(t Task) error
func (p *Pool) Stop()  // 优雅退出
```

**问题**：如何设计 Stop 不丢失已提交任务？`Submit` 在 pool 关闭后应返回什么错误？

<details>
<summary>答案与解析</summary>

```go
type Pool struct {
    tasks   chan Task
    wg      sync.WaitGroup
    quit    chan struct{}
    closed  int32  // atomic
}

func NewPool(workers int) *Pool {
    p := &Pool{
        tasks: make(chan Task),
        quit:  make(chan struct{}),
    }
    for i := 0; i < workers; i++ {
        p.wg.Add(1)
        go p.worker()
    }
    return p
}

func (p *Pool) worker() {
    defer p.wg.Done()
    for {
        select {
        case t, ok := <-p.tasks:
            if !ok {
                return  // channel 关闭，退出
            }
            if err := t.Fn(); err != nil {
                log.Printf("task %d failed: %v", t.ID, err)
            }
        case <-p.quit:
            // 处理完 quit 前已接收的任务？
            // 实际上 quit 和 tasks 同时 ready 时随机选择
            // 更好的设计：
            return
        }
    }
}

func (p *Pool) Submit(t Task) error {
    if atomic.LoadInt32(&p.closed) == 1 {
        return errors.New("pool closed")
    }
    select {
    case p.tasks <- t:
        return nil
    default:
        return errors.New("pool full")
    }
}

func (p *Pool) Stop() {
    if atomic.CompareAndSwapInt32(&p.closed, 0, 1) {
        close(p.quit)   // 通知不再接收新任务
        // 等待已有任务完成？需要另一个机制
    }
}
```

**更优雅的设计（两阶段关闭）**：
```go
func (p *Pool) Stop() {
    close(p.tasks)  // 不再接收新任务，worker 处理完缓冲后退出
    p.wg.Wait()
}
```

**考点**：Worker Pool 的关闭顺序：
1. 停止接受新任务（`close(tasks)` 或标志位）。
2. 等待所有 worker 处理完已有任务（`wg.Wait()`）。
3. 不要直接 `close(quit)`，否则可能丢失已缓冲任务。

</details>

---

### 题 9：Fan-Out / Fan-In 模式

```go
func producer() <-chan int { ... }  // 产生大量数据

func consumer(id int, in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- process(n)  // 耗时处理
        }
        close(out)
    }()
    return out
}

func merge(cs ...<-chan int) <-chan int {
    // 实现？
}
```

**问题**：实现 `merge` 函数，合并多个 channel。如何处理**部分消费者提前退出**导致的 goroutine 泄漏？`sync.WaitGroup` 和 `errgroup` 的适用场景？

<details>
<summary>答案与解析</summary>

**基础实现（有泄漏风险）**：
```go
func merge(cs ...<-chan int) <-chan int {
    var wg sync.WaitGroup
    out := make(chan int)
    
    output := func(c <-chan int) {
        defer wg.Done()
        for n := range c {
            out <- n
        }
    }
    
    wg.Add(len(cs))
    for _, c := range cs {
        go output(c)
    }
    
    go func() {
        wg.Wait()
        close(out)
    }()
    return out
}
```

**问题**：如果下游只取部分数据就退出，`out` 无人消费，`output` 中的 `out <- n` 永久阻塞，goroutine 泄漏。

**修复（select + done）**：
```go
func merge(done <-chan struct{}, cs ...<-chan int) <-chan int {
    var wg sync.WaitGroup
    out := make(chan int)
    
    output := func(c <-chan int) {
        defer wg.Done()
        for n := range c {
            select {
            case out <- n:
            case <-done:
                return
            }
        }
    }
    
    wg.Add(len(cs))
    for _, c := range cs {
        go output(c)
    }
    
    go func() {
        wg.Wait()
        close(out)
    }()
    return out
}

// 使用
done := make(chan struct{})
defer close(done)  // 通知所有 goroutine 退出
out := merge(done, c1, c2, c3)
```

**errgroup 场景**：
```go
import "golang.org/x/sync/errgroup"

func mergeWithError(ctx context.Context, cs ...<-chan int) (<-chan int, <-chan error) {
    g, ctx := errgroup.WithContext(ctx)
    out := make(chan int)
    
    for _, c := range cs {
        c := c
        g.Go(func() error {
            for n := range c {
                select {
                case out <- n:
                case <-ctx.Done():
                    return ctx.Err()
                }
            }
            return nil
        })
    }
    
    go func() {
        g.Wait()
        close(out)
    }()
    return out, g.Wait()  // 简化
}
```

**考点**：Fan-In 必须有**取消机制**，否则下游提前退出泄漏上游。

</details>

---

### 题 10：Context 取消传播

```go
func parent(ctx context.Context) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    
    go childA(ctx)
    go childB(ctx)
    
    // 如果这里提前返回，cancel 被调用，childA/B 能感知吗？
    // 如果 childA 内部又 WithCancel，取消 parent 会影响 childA 的子 context 吗？
}
```

**问题**：Context 的树形结构是什么？`cancel` 的传播方向？`WithValue` 的父节点查询机制？为什么 `context.Value` 不适合做请求参数传递？

<details>
<summary>答案与解析</summary>

**答案**：

**Context 树**：
- 每个 `WithCancel`/`WithTimeout`/`WithValue` 创建子节点，形成树。
- `cancel` 从父节点向**所有子节点**递归传播（通过 `done` channel 关闭）。
- 取消是**单向**的：子节点取消不影响父节点。

**传播机制**：
- `parent.cancel()` 关闭自己的 `done` channel。
- 子节点通过 `parent.Done()` 感知，级联关闭。

**WithValue**：
- 基于**不可变链表**实现，每次 `WithValue` 创建新节点，指向父节点。
- 查找时沿链表向上遍历，O(n) 复杂度。
- key 必须是**可比较类型**，且建议用私有类型防止冲突：
  ```go
  type key struct{}
  ctx = context.WithValue(ctx, key{}, "value")
  ```

**不适合做请求参数**：
- 无类型安全：`ctx.Value(key)` 返回 `interface{}`，需类型断言。
- 隐式依赖：函数签名不体现依赖哪些值，难以追踪。
- 性能：链表遍历有开销。

**适用场景**：请求元数据（traceID、userID）、取消信号、截止时间。

**考点**：Context 是**取消信号树**，不是数据容器。

</details>

---

## Level 4：竞态、死锁与内存序（3 题）

### 题 11：Happens-Before 与 Channel

```go
var a string
var done = make(chan bool)

func setup() {
    a = "hello"
    done <- true
}

func main() {
    go setup()
    <-done
    fmt.Println(a)  // 一定能打印 "hello" 吗？
}
```

**问题**：为什么一定能？`done <- true` 和 `<-done` 的 happens-before 关系是什么？如果改成 `close(done)` 呢？如果 `done` 是有缓冲 channel，还保证吗？

<details>
<summary>答案与解析</summary>

**答案**：一定能打印 `"hello"`。

**解析**：

**Channel 的 Happens-Before**：
- **发送** happens-before **对应的接收完成**。
- 即 `done <- true` 之前的所有操作（`a = "hello"`），对 `<-done` 完成后的操作可见。

**close 的 happens-before**：
- `close(ch)` happens-before 任何从 `ch` 的接收返回（`ok=false`）。
- 所以改成 `close(done)` 同样保证。

**有缓冲 channel**：
- 对于缓冲 channel，**发送** happens-before **发送完成**（即 `ch <- v` 返回后），但**不一定** happens-before 接收。
- 但如果发送方在发送前写入 `a`，且接收方在接收后读取 `a`，仍然保证：
  - 发送 `done <- true` happens-before 接收 `<-done`（因为 channel 有 happens-before 语义，无论有无缓冲）。
  
  等等，需要纠正。Go Memory Model 原文：
  - A send on a channel happens before the corresponding receive from that channel completes.
  - The closing of a channel happens before a receive that returns a zero value because the channel is closed.

  对于缓冲 channel，发送和接收的 happens-before 关系仍然成立（发送 happens before 对应接收完成）。所以仍然保证。

**考点**：channel 通信是 Go 中最主要的同步原语，提供 happens-before 保证。

</details>

---

### 题 12：死锁检测

```go
func deadlock1() {
    ch := make(chan int)
    ch <- 1
    <-ch
}

func deadlock2() {
    ch := make(chan int, 1)
    ch <- 1
    ch <- 2
}

func deadlock3() {
    var mu sync.Mutex
    mu.Lock()
    mu.Lock()
}
```

**问题**：哪些会触发 `fatal error: all goroutines are asleep - deadlock!`？为什么 `deadlock2` 不是死锁？`sync.Mutex` 的重入死锁能被检测吗？

<details>
<summary>答案与解析</summary>

**答案**：
- `deadlock1`：**检测为死锁**（fatal error）。
- `deadlock2`：**不是死锁**（阻塞但不是死锁，只是 channel 满）。
- `deadlock3`：**死锁**（fatal error）。

**解析**：

**Go 死锁检测**：
- 运行时检测**所有 goroutine 都阻塞**且无法被唤醒的状态。
- 阻塞原因：channel、mutex、select、waitgroup 等。

**deadlock1**：
- 单 goroutine 中，`ch <- 1` 阻塞（无接收者），且没有其他 G 可以唤醒它。所有 G  asleep → 死锁。

**deadlock2**：
- `ch <- 2` 阻塞（缓冲满），但这不是"所有 G asleep"，只是当前 G 阻塞。如果有其他 G 来接收，可以继续。运行时不会报死锁。

**deadlock3**：
- `sync.Mutex` 不可重入。第二次 `Lock` 阻塞，且没有其他 G 能解锁（因为第一次 Lock 的 G 阻塞了）。所有 G asleep → 死锁。

**不可检测的死锁**：
```go
// 两个 G 互相等待
go func() {
    mu1.Lock()
    mu2.Lock()
}()
go func() {
    mu2.Lock()
    mu1.Lock()
}()
```
- 两个 G 都阻塞，且互相等待。运行时**能检测**（所有 G 阻塞）。

```go
// 等待外部输入
ch := make(chan int)
<-ch  // 永远阻塞，但运行时不知道外部是否会发送
```
- 不会报死锁，因为理论上外部可能唤醒。

**考点**：Go 死锁检测是**保守**的，只报"确定死锁"，可能漏报。

</details>

---

### 题 13：Channel vs Atomic 内存序

```go
var flag int32
var msg string

func setup() {
    msg = "hello"
    atomic.StoreInt32(&flag, 1)
}

func main() {
    for atomic.LoadInt32(&flag) == 0 {
        runtime.Gosched()
    }
    fmt.Println(msg)  // 一定能打印 "hello" 吗？
}
```

**问题**：`atomic` 的内存序保证是什么？如果改成 `var flag = make(chan bool)` 实现，有何优劣？`atomic` 和 `chan` 在同步场景如何选择？

<details>
<summary>答案与解析</summary>

**答案**：一定能打印 `"hello"`。

**解析**：

**Atomic 内存序**：
- `atomic.StoreInt32` 有 **release** 语义：之前的写入（`msg = "hello"`）对后续 `atomic.LoadInt32`（acquire）可见。
- `atomic.LoadInt32` 有 **acquire** 语义：之后的读取（`fmt.Println(msg)`）能看到之前 release 的写入。

**Channel 实现对比**：
```go
var done = make(chan bool)
var msg string

func setup() {
    msg = "hello"
    done <- true
}

func main() {
    <-done
    fmt.Println(msg)
}
```

**选择**：
- **Atomic**：轻量（~10ns），适合简单标志、计数器。语义简单。
- **Channel**：适合复杂同步、多 goroutine 协调、取消传播。有 goroutine 调度开销（~100ns+）。

**考点**：`atomic` 是**底层内存序原语**，channel 是**高级同步抽象**。

</details>

---

## Level 5：工程与性能（3 题）

### 题 14：百万级 Goroutine 连接管理

**场景**：实现一个聊天服务器，支持 100 万 WebSocket 连接。

**问题**：`Goroutine-per-connection` 模型是否可行？每个 Goroutine 的内存开销？如何优化？`sync.Pool` 在此场景的作用？

<details>
<summary>答案与解析</summary>

**答案**：可行，但需要优化。

**解析**：

**Goroutine 开销**：
- 初始栈 2KB，按需要增长。百万连接 ≈ 2GB 栈空间（如果都空闲）。
- 实际通常 4-8KB 平均栈，百万连接 ≈ 4-8GB，现代服务器可承受。

**优化方案**：
1. **减少栈增长**：避免深层调用、大局部变量。
2. **Reactor 模式**：用 `epoll` + 少量 goroutine 处理网络事件（如 `gnet`、`cloudwego/netpoll`）。
3. **对象池化**：
   ```go
   var bufPool = sync.Pool{
       New: func() interface{} {
           return make([]byte, 1024)
       },
   }
   ```
4. **连接级别限流**：每个连接独立 goroutine，但全局控制并发处理数。

**sync.Pool**：
- 缓存临时对象，减少 GC 压力。
- 注意：Pool 中的对象可能被 GC 随时清除，不能假设持久存在。

**考点**：Go 的 goroutine-per-connection 是官方推荐模式，但极端场景需考虑 Reactor。

</details>

---

### 题 15：Channel 作为信号量 vs sync.Semaphore

```go
// Channel 信号量
var sem = make(chan struct{}, 10)

func worker() {
    sem <- struct{}{}      // Acquire
    defer func() { <-sem }()  // Release
    // work
}

// x/sync/semaphore
var sem = semaphore.NewWeighted(10)

func worker(ctx context.Context) {
    sem.Acquire(ctx, 1)
    defer sem.Release(1)
}
```

**问题**：Channel 信号量有什么缺陷？`semaphore.Weighted` 的优势？什么时候必须用 `semaphore`？

<details>
<summary>答案与解析</summary>

**答案**：

**Channel 信号量缺陷**：
1. **无法动态调整权重**：只能 1 个 1 个获取，不能一次获取 N。
2. **无 Context 支持**：不能超时/取消。
3. **释放不检查**：可以从空 channel 接收（如果实现不当），导致计数为负。
4. **无公平性**：多个 goroutine 竞争，可能饥饿。

**semaphore.Weighted 优势**：
1. **权重支持**：`Acquire(ctx, N)` 一次获取 N 个许可。
2. **Context 集成**：支持超时和取消。
3. **公平队列**：内部使用等待队列，FIFO 或公平调度。
4. **正确性**：释放必须对应已获取的许可。

**必须用 semaphore 的场景**：
- 需要**动态权重**（如大任务占 5 个许可，小任务占 1 个）。
- 需要**超时控制**。
- 需要**公平性**保证。

**考点**：channel 信号量适合简单场景，复杂场景用标准库 `x/sync/semaphore`。

</details>

---

### 题 16：优先级 Channel 实现

**要求**：实现一个优先级队列，支持多个优先级的 channel，高优先级优先处理。

```go
type PriorityQueue struct { ... }
func (pq *PriorityQueue) Send(priority int, v int) error
func (pq *PriorityQueue) Recv() (int, error)
```

**问题**：如何用 Go 的 channel 实现？`select` 的随机性如何破坏优先级？如何保证高优先级绝对优先？

<details>
<summary>答案与解析</summary>

**答案**：不能用 `select` 实现严格优先级，因为 `select` 是随机公平的。

**实现**：

```go
type PriorityQueue struct {
    levels []chan int  // 0 = highest priority
    mu     sync.Mutex
}

func (pq *PriorityQueue) Recv() (int, error) {
    for {
        // 严格从高到低检查
        for i := range pq.levels {
            select {
            case v := <-pq.levels[i]:
                return v, nil
            default:
                // 该优先级无数据，继续检查下一级
            }
        }
        // 所有队列都空，阻塞等待任意一个
        // 需要更复杂的机制...
    }
}
```

**问题**：上述 `Recv` 在优先级 0 有数据时，可能因 `default` 的轮询消耗 CPU。如何阻塞等待但保持优先级？

**正确实现（使用聚合 channel + 优先级检查）**：
```go
type PriorityQueue struct {
    levels []chan int
    notify chan struct{}  // 有数据时通知
}

func (pq *PriorityQueue) Send(priority int, v int) error {
    if priority >= len(pq.levels) {
        return errors.New("invalid priority")
    }
    pq.levels[priority] <- v
    select {
    case pq.notify <- struct{}{}:
    default:
    }
    return nil
}

func (pq *PriorityQueue) Recv() (int, error) {
    for {
        // 先非阻塞检查高优先级
        for i := range pq.levels {
            select {
            case v := <-pq.levels[i]:
                return v, nil
            default:
            }
        }
        // 阻塞等待通知
        <-pq.notify
    }
}
```

**更优方案**：使用 `container/heap` 实现内存中的优先级队列，而不是 channel。

**考点**：Go channel 没有优先级概念，`select` 随机公平。严格优先级需要**轮询 + 阻塞**或**不用 channel**。

</details>

---

## 综合设计题（压轴）

### 题 17：实现一个完整的并发任务执行器

**要求**：
```go
type Executor struct { ... }

func NewExecutor(maxConcurrent int) *Executor
func (e *Executor) Submit(ctx context.Context, fn func() error) error
func (e *Executor) Wait() error  // 等待所有任务完成，返回第一个错误
```

**约束**：
- 最多 `maxConcurrent` 个 goroutine 同时执行
- 支持 Context 取消：取消后正在执行的任务继续，未开始的不再执行
- `Submit` 在 executor 关闭后返回错误
- 不泄漏 goroutine
- 返回所有错误中的第一个（或聚合）

**请写出完整实现。**

<details>
<summary>答案与解析</summary>

```go
type Executor struct {
    sem     chan struct{}     // 信号量控制并发
    wg      sync.WaitGroup
    ctx     context.Context
    cancel  context.CancelFunc
    closed  int32             // atomic
    errOnce sync.Once
    firstErr error
}

func NewExecutor(maxConcurrent int) *Executor {
    ctx, cancel := context.WithCancel(context.Background())
    return &Executor{
        sem:    make(chan struct{}, maxConcurrent),
        ctx:    ctx,
        cancel: cancel,
    }
}

func (e *Executor) Submit(ctx context.Context, fn func() error) error {
    if atomic.LoadInt32(&e.closed) == 1 {
        return errors.New("executor closed")
    }
    
    select {
    case e.sem <- struct{}{}:  // Acquire
    case <-ctx.Done():
        return ctx.Err()
    case <-e.ctx.Done():
        return e.ctx.Err()
    }
    
    e.wg.Add(1)
    go func() {
        defer e.wg.Done()
        defer func() { <-e.sem }()  // Release
        
        // 检查是否已取消
        select {
        case <-e.ctx.Done():
            return
        default:
        }
        
        if err := fn(); err != nil {
            e.errOnce.Do(func() {
                e.firstErr = err
                e.cancel()  // 取消其他未开始任务
            })
        }
    }()
    return nil
}

func (e *Executor) Wait() error {
    e.wg.Wait()
    return e.firstErr
}

func (e *Executor) Close() error {
    if atomic.CompareAndSwapInt32(&e.closed, 0, 1) {
        e.cancel()
    }
    return nil
}
```

**设计要点**：
1. **信号量控制并发**：`sem` channel 容量 = `maxConcurrent`。
2. **Context 层级**：`e.ctx` 用于控制 executor 生命周期，`ctx` 参数用于单个任务超时。
3. **错误处理**：`sync.Once` 记录第一个错误，并触发取消。
4. **关闭语义**：`closed` 标志位阻止新提交。
5. **不泄漏**：`wg.Wait()` 确保所有 goroutine 完成。

**改进（聚合所有错误）**：
```go
var errMu sync.Mutex
var errs []error

// 在 goroutine 中
if err := fn(); err != nil {
    errMu.Lock()
    errs = append(errs, err)
    errMu.Unlock()
    e.cancel()
}
```

**考点**：并发控制 + 生命周期管理 + 错误传播 + 无泄漏。

</details>

---

## Goroutine + Channel 面试速查卡

| 考点 | 一句话 | 必会陷阱 |
|------|--------|----------|
| GMP | P 是调度单元，M 阻塞时释放 P | GOMAXPROCS 默认 CPU 数，阻塞导致 M 膨胀 |
| 栈增长 | 连续栈，2KB 初始，1GB 上限 | Go 1.14+ 信号抢占，之前纯循环无法抢占 |
| hchan | 环形 buf + sendq/recvq + 锁 | 不是无锁结构，操作有锁竞争 |
| 关闭语义 | 广播 recvq，重复关闭 panic | 只能由发送方关闭，关闭后发送 panic |
| select | 编译为 selectgo，随机轮询 | time.After 泄漏，nil channel 永不 ready |
| happens-before | 发送 happens-before 对应接收完成 | 用于无锁同步，close 也有 hb |
| 死锁检测 | 所有 G 阻塞时 fatal error | 保守检测，可能漏报 |
| Pipeline | 必须带 context 取消 | 下游 break 上游泄漏 |
| Worker Pool | 两阶段关闭：停提交 → 等完成 | 直接 close(quit) 丢失任务 |
| Fan-In | 用 done channel 防泄漏 | 下游提前退出，上游阻塞泄漏 |
| 信号量 | channel 适合简单 1-weight | 动态权重、超时用 x/sync/semaphore |
| 优先级 | select 随机，无法保证优先级 | 需轮询 + 阻塞，或不用 channel |

---

**下一个模块？** `sync` 包（Mutex/Map/Pool/Once/WaitGroup）？还是直接上 **Go 内存模型 + GC**？