# Go 内存模型 & Happens-Before 全集

---

## 什么是 Happens-Before（HB）

**一句话**：如果事件 A happens-before 事件 B，那么 A 的所有内存写入对 B **一定可见**。编译器和 CPU 不能跨越 HB 边界重排读写。

**不是物理时间**：HB 是**偏序关系**，不是"先发生"。两个事件可能**无 HB 关系**（并发），此时读写顺序**未定义**。

**单 goroutine 内**：程序顺序（Program Order）天然提供 HB。

---

## 六大 HB 来源（官方内存模型）

---

### 1. Init（包初始化）

**规则**：包 `p` 的 `init` 函数执行 happens-before 任何 `p` 的函数执行。

```go
var a = 1  // 零值初始化 happens-before init

func init() {
    a = 2  // happens-before main
}

func main() {
    fmt.Println(a)  // 一定打印 2
}
```

**面试点**：包级变量初始化 → `init()` → `main()` 有天然 HB 链。

---

### 2. Goroutine 创建

**规则**：`go` 语句启动 goroutine happens-before 该 goroutine 的执行。

```go
var a string

func f() {
    fmt.Println(a)  // 一定打印 "hello"
}

func main() {
    a = "hello"
    go f()  // a="hello" happens-before f() 执行
}
```

**陷阱**：反过来**不成立**。goroutine 的写入对创建者**不自动可见**。

---

### 3. Channel（最复杂，4 条规则）

#### 规则 3a：Unbuffered / Buffered 通用
> 对 channel `c` 的**发送** happens-before 从 `c` 的**对应接收完成**。

#### 规则 3b：Buffered 专用
> 对 buffered channel `c` 的**第 k 个发送** happens-before **第 k 个接收完成**。  
> 对 buffered channel `c` 的**第 k 个接收** happens-before **第 k+1 个发送完成**。

#### 规则 3c：Close
> 关闭 channel `c` happens-before 任何因 `c` 关闭而返回的接收。

---

### 题 1：Channel 容量决定可见性（面试最高频）

```go
var a string
var done = make(chan bool)  // 容量 0

func setup() {
    a = "hello"
    done <- true
}

func main() {
    go setup()
    <-done
    fmt.Println(a)  // 一定打印 "hello"？
}
```

**如果把 `done` 改成 `make(chan bool, 1)`，结果会变吗？**

<details>
<summary>答案与解析</summary>

**答案**：无论容量 0 还是 1，都一定打印 `"hello"`。

**解析**：

- **容量 0**：`done <- true`（发送）和 `<-done`（接收）是**同步对**。发送 happens-before 接收完成，所以 `a = "hello"` 对 `<-done` 之后的代码可见。

- **容量 1**：`done <- true` 不阻塞（缓冲未满）。但规则 3a 仍然成立：**发送 happens-before 对应接收完成**。`a = "hello"` 在发送之前，所以对 `<-done` 之后可见。

**真正区别**：
```go
// 容量 1，但接收在发送之前？
<-done      // 阻塞！因为还没发送
done <- true
```
这不会死锁吗？主 goroutine 先接收，setup 还没发送，阻塞。

**经典陷阱**：
```go
var done = make(chan bool, 1)  // 缓冲 1
var a string

func setup() {
    a = "hello"
    done <- true
    a = "world"  // 这行对 main 可见吗？
}

func main() {
    go setup()
    <-done
    fmt.Println(a)  // 可能 "hello" 或 "world"？
}
```

**答案**：**可能 "world"**！

**解析**：
- `done <- true` happens-before `<-done` 完成。
- 但 `a = "world"` 在**发送之后**，与 `<-done` **无 HB 关系**。
- 所以 `main` 可能看到 `"world"`，也可能看到 `"hello"`（如果编译器重排）。

**考点**：channel 只保证**发送前**的写入可见，**发送后**的写入不保证。

</details>

---

### 题 2：Buffered Channel 的 k-th 规则（进阶）

```go
var a, b string
var c = make(chan int, 10)

func f() {
    a = "hello"
    c <- 0        // 第 1 个发送
    b = "world"
    c <- 1        // 第 2 个发送
}

func main() {
    go f()
    <-c             // 第 1 个接收
    fmt.Println(a)  // 一定 "hello"？
    fmt.Println(b)  // 一定 "world"？
    <-c             // 第 2 个接收
    fmt.Println(b)  // 现在一定 "world"？
}
```

**问题**：三次打印分别是否确定？为什么？

<details>
<summary>答案与解析</summary>

**考点**：Buffered channel 的**第 k 次接收 happens-before 第 k+1 次发送**，这是构建 HB 链的关键。

</details>

---

### 题 3：Close 的广播与 HB

```go
var a string
var done = make(chan bool)

func setup() {
    a = "hello"
    close(done)
}

func main() {
    go setup()
    <-done
    fmt.Println(a)  // 一定 "hello"？
    
    v, ok := <-done
    fmt.Println(v, ok)  // 输出？
}
```

**问题**：`close` 的 HB 保证？重复接收关闭的 channel，`ok` 的值？如果 `done` 是有缓冲且已写入值，`close` 后接收的顺序？

<details>
<summary>答案与解析</summary>

**答案**：
- `fmt.Println(a)`：**一定 `"hello"`**
- `v, ok`：`false, false`（零值 + false）

**解析**：

**Close HB**：
- `close(done)` happens-before 任何因关闭而返回的接收。
- `a = "hello"` 在 `close` 之前（同 goroutine），所以可见。

**重复接收**：
- 缓冲清空后，接收返回零值 + `ok=false`。
- 再次接收仍然返回零值 + `ok=false`，**不会 panic**。

**有缓冲 channel 的 close + 接收顺序**：
```go
ch := make(chan int, 2)
ch <- 1
ch <- 2
close(ch)

<-ch  // 1, true
<-ch  // 2, true
<-ch  // 0, false
```

- 先接收缓冲中的值（按 FIFO），然后接收零值。
- `close` happens-before 所有零值接收，但**不保证** `close` happens-before 缓冲值的接收？不，缓冲值的接收也有 HB（发送 happens-before 接收）。

**考点**：`close` 是**广播信号**，不是数据终点。

</details>

---

### 4. Mutex / RWMutex

**规则**：对 mutex `m` 的 **Unlock** happens-before 任何后续对 `m` 的 **Lock**。

```go
var mu sync.Mutex
var a string

func f() {
    a = "hello"
    mu.Unlock()
}

func main() {
    mu.Lock()
    go f()
    mu.Lock()  // 等待 f 的 Unlock
    fmt.Println(a)  // 一定 "hello"
}
```

**注意**：Lock/Unlock 的 HB 是**成对**的。同一个 goroutine 内连续 Lock/Unlock 不提供 HB（除非中间有 Unlock）。

---

### 题 4：Mutex 的 HB 方向

```go
var mu sync.Mutex
var a, b int

func f() {
    a = 1
    mu.Unlock()
}

func g() {
    mu.Lock()
    b = a
    mu.Unlock()
}

func main() {
    go f()
    go g()
    time.Sleep(time.Second)
    fmt.Println(b)
}
```

**问题**：`b` 一定等于 1 吗？如果 `f` 和 `g` 的执行顺序不确定呢？`mu.Unlock()` 在 `f` 中，`mu.Lock()` 在 `g` 中，HB 链如何建立？

<details>
<summary>答案与解析</summary>

**答案**：**不一定**。`b` 可能为 0 或 1。

**解析**：

**HB 链尝试**：
- `a = 1` → `mu.Unlock()`（f 中，程序顺序）
- `mu.Unlock()`（f）→ `mu.Lock()`（g）【如果 g 的 Lock 在 f 的 Unlock 之后】

**问题**：`g` 的 `mu.Lock()` 可能发生在 `f` 的 `mu.Unlock()` **之前**！
- 如果 `g` 先执行：`mu.Lock()` 成功，`b = a`（此时 `a` 可能还是 0），然后 `mu.Unlock()`。
- 然后 `f` 执行：`mu.Unlock()`（但此时 mutex 已解锁，f 的 Unlock 会 panic？不，f 没有先 Lock！）

等等，`f` 中直接 `mu.Unlock()`，但 `f` 没有先 `mu.Lock()`！这是**未定义行为**，可能 panic（unlock of unlocked mutex）。

**修正题目**：
```go
func f() {
    mu.Lock()
    a = 1
    mu.Unlock()
}
```

**修正后**：
- 如果 `g` 先 Lock：`b = a`（a=0），然后 `f` Lock，`a=1`。最终 `b=0`。
- 如果 `f` 先 Lock：`a=1`，Unlock，然后 `g` Lock：`b=1`。

**考点**：Unlock → Lock 的 HB 只在**正确的成对使用**下成立。如果 `g` 先拿到锁，它看不到 `f` 的写入。

**另一个陷阱**：
```go
mu.Lock()
a = 1
mu.Unlock()

mu.Lock()
b = a  // 一定看到 a=1？
mu.Unlock()
```

**答案**：**一定**。同一个 goroutine 内，Unlock → Lock 有 HB，且 `a=1` → Unlock（程序顺序），Lock → `b=a`（程序顺序）。完整 HB 链。

</details>

---

### 5. Atomic（Go 1.19+ 明确）

**规则**：对 atomic 变量 `v` 的 **Store/Add/CAS/Swap** happens-before 对 `v` 的 **Load/CAS/Add/Swap** 观察到该写入。

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
    fmt.Println(msg)  // 一定 "hello"
}
```

**Acquire-Release 语义**：
- `Store` = **Release**：之前的写入对后续 `Load` 可见。
- `Load` = **Acquire**：之后的读取能看到之前 `Store` 的写入。

---

### 题 5：Atomic vs Mutex 的 HB 等价性

```go
var ready int32
var a string

func setup() {
    a = "hello"
    atomic.StoreInt32(&ready, 1)
}

func main() {
    for atomic.LoadInt32(&ready) == 0 {}
    fmt.Println(a)  // 一定 "hello"？
}

// 对比 mutex 版本
var mu sync.Mutex
var ready2 bool
var a2 string

func setup2() {
    a2 = "hello"
    mu.Unlock()
}

func main2() {
    mu.Lock()
    for !ready2 {
        mu.Unlock()
        mu.Lock()
    }
    fmt.Println(a2)
}
```

**问题**：atomic 版本和 mutex 版本的 HB 等价吗？`atomic` 的 `Load/Store` 与 `Mutex` 的 `Lock/Unlock` 在性能上有何差异？如果 `ready` 是 `atomic.Bool`（Go 1.19+），有何改进？

<details>
<summary>答案与解析</summary>

**答案**：**HB 等价**，但实现和性能不同。

**解析**：

**HB 等价性**：
- `atomic.Store`（release）→ `atomic.Load`（acquire）的 HB 关系，与 `Unlock` → `Lock` 等价。
- 两者都能保证 `a = "hello"` 对 `fmt.Println(a)` 可见。

**性能差异**：
- `atomic`：通常 ~10-20ns，无内核态切换（用户态原子指令）。
- `mutex`：无竞争时 ~20-30ns（futex 快速路径），有竞争时可能陷入内核（~100ns+）。

**`atomic.Bool`**：
```go
var ready atomic.Bool
ready.Store(true)
// ...
for !ready.Load() {}
```
- 类型安全，避免 `int32` 的误用。
- 底层仍是 `atomic` 指令，性能相同。

**考点**：Go 1.19+ 后 `atomic` 提供**与 mutex 同等的 HB 保证**，是轻量同步的首选。

</details>

---

### 6. Once / WaitGroup

#### sync.Once
**规则**：`once.Do(f)` 中的 `f()` 完成 happens-before 任何后续 `once.Do` 的返回。

```go
var once sync.Once
var a string

func setup() {
    a = "hello"
}

func main() {
    once.Do(setup)
    go once.Do(setup)  // 不执行，但返回 happens-after 第一次 setup
    fmt.Println(a)     // 一定 "hello"
}
```

#### sync.WaitGroup
**规则**：`WaitGroup.Wait()` 返回 happens-after 计数器变为 0。计数器由 `Done` 或 `Add` 的负值减少。

```go
var wg sync.WaitGroup
var a string

func setup() {
    a = "hello"
    wg.Done()
}

func main() {
    wg.Add(1)
    go setup()
    wg.Wait()
    fmt.Println(a)  // 一定 "hello"
}
```

**注意**：`Wait` 返回后能看到 `Done` 之前的写入，因为 `Done` 内部有 release，`Wait` 内部有 acquire。

---

### 题 6：WaitGroup 的 Add 与 Done 的 HB

```go
var wg sync.WaitGroup
var a string

func worker() {
    a = "hello"
    wg.Done()
}

func main() {
    wg.Add(1)
    go worker()
    wg.Wait()
    fmt.Println(a)  // 一定 "hello"？
    
    // 如果 wg.Add(1) 放在 go worker() 之后？
    go worker()
    wg.Add(1)
    wg.Wait()
}
```

**问题**：`Add` 和 `Done` 的时序要求？`Add` 必须在 `Done` 之前吗？如果 `Add` 在 `Done` 之后调用会怎样？`Wait` 返回后，新启动的 goroutine 能看到 `a` 吗？

<details>
<summary>答案与解析</summary>

**答案**：
- 第一个版本：**一定 `"hello"`**
- 第二个版本：**竞态（Race）**，可能 `Wait` 在 `Add` 前返回，漏掉 worker。

**解析**：

**WaitGroup 的时序**：
- `Add` 必须在 `Done` 之前（逻辑上）。如果 `Done` 在 `Add` 之前，计数器可能先变成 0，`Wait` 返回，然后 `Add(1)`，计数器变成 1，但 `Wait` 已经返回了，worker 泄漏。

**正确模式**：
```go
wg.Add(1)
go func() {
    defer wg.Done()
    // work
}()
```

**Wait 返回后的 HB**：
- `Wait` 返回 happens-after 最后一个 `Done`。
- 但 `Wait` 返回后新启动的 goroutine **不自动继承**这个 HB。如果新 goroutine 读取 `a`，需要新的同步。

**考点**：`Add` 必须在 goroutine 启动**之前**或**内部**（用 `defer`），绝不能在 `Done` 之后。

</details>

---

## Level 3：Goroutine 生命周期陷阱（3 题）

### 题 7：Goroutine 退出无 HB（最经典）

```go
var a string

func hello() {
    a = "hello"
}

func main() {
    go hello()
    fmt.Println(a)  // 一定打印 ""？可能打印 "hello"？
}
```

**问题**：为什么**不一定**是 `""`？为什么可能打印 `"hello"` 也**不保证**？如何修复？

<details>
<summary>答案与解析</summary>

**答案**：**未定义行为**（Data Race）。可能打印 `""`、`"hello"`，或其他任意值（如半写状态）。

**解析**：

**Go 内存模型**：
- `go hello()` happens-before `hello()` 的执行。
- 但 `hello()` 的退出**不 happens-before** `main()` 的 `fmt.Println`。
- 两者之间**无 HB 关系**。

**为什么可能看到 `"hello"`**：
- 物理时间上 `hello()` 可能先执行完，但编译器/CPU 可能重排写入，或缓存未刷新。

**修复**：
```go
// 方案 1：channel
var done = make(chan bool)
go func() {
    a = "hello"
    done <- true
}()
<-done

// 方案 2：WaitGroup
var wg sync.WaitGroup
wg.Add(1)
go func() {
    a = "hello"
    wg.Done()
}()
wg.Wait()

// 方案 3：atomic
var ready atomic.Bool
go func() {
    a = "hello"
    ready.Store(true)
}()
for !ready.Load() {}
```

**考点**：goroutine 的写入**绝不自动同步**给父 goroutine，必须显式同步。

</details>

---

### 题 8：父 goroutine 写入对子 goroutine 可见？

```go
var a = "hello"

func main() {
    a = "world"
    go func() {
        fmt.Println(a)  // 一定 "world"？
    }()
    time.Sleep(time.Second)
}
```

**问题**：`a = "world"` 对子 goroutine 一定可见吗？`go` 语句的 HB 规则具体是什么？

<details>
<summary>答案与解析</summary>

**答案**：**一定 `"world"`**。

**解析**：

**Goroutine 创建 HB**：
- `go` 语句之前的所有操作（包括 `a = "world"`）happens-before 新 goroutine 的执行。
- 即 `a = "world"` → `go func()` → `fmt.Println(a)` 有 HB 链。

**注意**：这是**单向**的。子 goroutine 的写入对父 goroutine **不**自动可见。

**考点**：`go` 语句是**同步点**，创建前的写入对新 goroutine 可见。

</details>

---

### 题 9：Data Race 的未定义行为

```go
var a int

func main() {
    go func() { a = 1 }()
    go func() { a = 2 }()
    time.Sleep(time.Second)
    fmt.Println(a)
}
```

**问题**：这是 data race 吗？`go run -race` 会报什么？如果没有 data race，输出一定是什么？编译器/CPU 如何重排？

<details>
<summary>答案与解析</summary>

**答案**：**是 data race**。`-race` 会报 `WARNING: DATA RACE`。

**解析**：

**Data Race 定义**：
- 两个 goroutine 同时访问同一内存位置，且至少一个是写入，**无同步**。

**未定义行为**：
- 有 data race 的程序，Go 不保证任何行为。
- 可能输出 `1`、`2`、`-1`、崩溃，或**任何值**。
- 编译器可能假设无 race 而重排/优化，导致奇怪结果。

**重排示例**：
```go
// 编译器可能把：
a = 1
b = 2

// 重排为：
b = 2
a = 1
```
因为单 goroutine 内 `a` 和 `b` 无关。但如果有 race，重排可能导致其他 goroutine 看到中间状态。

**修复**：用 `atomic` 或 `mutex`。

**考点**：**任何 data race 都是未定义行为**，不要依赖"实际输出"。

</details>

---

## Level 4：综合与对比（2 题）

### 题 10：证明无锁队列的正确性（工程题）

**实现**：
```go
type Node struct {
    value int
    next  atomic.Pointer[Node]
}

type LockFreeQueue struct {
    head atomic.Pointer[Node]
    tail atomic.Pointer[Node]
}

func (q *LockFreeQueue) Enqueue(v int) {
    // 请用 atomic 实现
}

func (q *LockFreeQueue) Dequeue() (int, bool) {
    // 请用 atomic 实现
}
```

**问题**：用 Go 的 `atomic.Pointer`（Go 1.19+）实现无锁队列。`Enqueue` 中如何保证新节点对 `Dequeue` 可见？`atomic.CompareAndSwapPointer` 的 HB 语义？

<details>
<summary>答案与解析</summary>

**实现**：
```go
func NewLockFreeQueue() *LockFreeQueue {
    dummy := &Node{}
    q := &LockFreeQueue{}
    q.head.Store(dummy)
    q.tail.Store(dummy)
    return q
}

func (q *LockFreeQueue) Enqueue(v int) {
    newNode := &Node{value: v}
    
    for {
        tail := q.tail.Load()
        next := tail.next.Load()
        
        if tail == q.tail.Load() {  // 检查 tail 是否变化
            if next == nil {
                // 尝试链接新节点
                if tail.next.CompareAndSwap(next, newNode) {
                    // 尝试更新 tail
                    q.tail.CompareAndSwap(tail, newNode)
                    return
                }
            } else {
                // tail 落后，尝试推进
                q.tail.CompareAndSwap(tail, next)
            }
        }
    }
}

func (q *LockFreeQueue) Dequeue() (int, bool) {
    for {
        head := q.head.Load()
        tail := q.tail.Load()
        next := head.next.Load()
        
        if head == q.head.Load() {
            if head == tail {
                if next == nil {
                    return 0, false  // 空队列
                }
                q.tail.CompareAndSwap(tail, next)
            } else {
                v := next.value
                if q.head.CompareAndSwap(head, next) {
                    return v, true
                }
            }
        }
    }
}
```

**HB 分析**：
- `tail.next.Store(newNode)`（通过 CAS）happens-before 后续 `head.next.Load()` 观察到该节点。
- 因为 `atomic.CompareAndSwap` 提供 release-acquire 语义。
- `newNode.value = v` 在 CAS 之前（同 goroutine 程序顺序），所以对后续读取可见。

**考点**：`atomic.Pointer` 的 CAS 提供**完整的 HB**，是无锁数据结构的基础。

</details>

---

### 题 11：Go vs Java/C++ 内存模型

| 特性 | Go | Java | C++ |
|------|-----|------|-----|
| 主要同步原语 | Channel, Mutex, Atomic | Monitor, volatile, Atomic | Mutex, Atomic, Memory Order |
| HB 来源 | 6 种（init, goroutine, channel, mutex, atomic, once/wg） | synchronized, volatile, thread start/join, final | mutex, atomic, fence, thread sync |
| 默认原子性 | 无（data race = UB） | 无（但 volatile 有） | 无 |
| 顺序一致性 | 单 goroutine 内 SC | 单线程内 SC | 单线程内 SC |
| 特色 | Channel 的 HB 是语言核心 | Happens-before + synchronizes-with | 6 种 memory order |

**问题**：Go 的 `channel` 对应 Java 的什么机制？Go 为什么没有 `volatile`？Go 的 `atomic` 与 C++ 的 `memory_order_relaxed` 有何不同？

<details>
<summary>答案与解析</summary>

**答案**：

**Go channel vs Java**：
- 类似 `BlockingQueue` + `happens-before`（Java 的 `BlockingQueue` 操作也有 HB）。
- 但 Go 的 channel HB 是**语言内存模型**的一部分，Java 是库实现。

**Go 为什么没有 `volatile`**：
- Go 的设计哲学：同步应该显式（channel、mutex、atomic）。
- `atomic` 提供与 Java `volatile` 类似的 acquire-release 语义（Go 1.19+）。
- 不需要单独的 `volatile` 关键字。

**Go atomic vs C++ `memory_order_relaxed`**：
- Go 的 `atomic.Load/Store` 是**sequentially consistent**（默认）或 **acquire-release**（Go 1.19 明确）。
- C++ 的 `memory_order_relaxed` **不提供任何 HB**，只是原子性。
- Go 没有 `relaxed` 模式，所有 atomic 操作都有至少 acquire-release 语义。

**考点**：Go 的内存模型**更简单**，没有 C++ 的 6 种 memory order，降低了心智负担。

</details>

---

## Happens-Before 速查表

| 机制 | HB 规则 | 常见陷阱 |
|------|---------|----------|
| **Init** | `init()` → 包函数 | 包级变量初始化 → init → main |
| **Goroutine 创建** | `go` 前 → goroutine 执行 | 单向！子 goroutine 退出不 HB 父 |
| **Channel 发送** | 发送 → 对应接收完成 | 发送**后**的写入不 HB |
| **Channel 缓冲** | 第 k 次接收 → 第 k+1 次发送 | 容量影响 HB 链构建 |
| **Channel 关闭** | close → 零值接收 | 关闭后发送 panic |
| **Mutex** | Unlock → 后续 Lock | 同 goroutine 连续 Lock/Unlock 无 HB |
| **Atomic** | Store → 观察到该写入的 Load | Go 1.19+ 明确 acquire-release |
| **Once** | f() 完成 → 后续 Do 返回 | f() 只执行一次，但 panic 会重试 |
| **WaitGroup** | Done → Wait 返回 | Add 必须在 Done 之前 |
| **单 goroutine** | 程序顺序 = HB | 编译器可重排，但保持单线程语义 |

---

**下一个模块？** `sync` 包详解（Mutex/Map/Pool/Once/Cond/WaitGroup 源码级）？还是 **GC 与内存管理**？