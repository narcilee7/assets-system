# Go `sync` 包深度全解

## 一、`sync.Mutex` — 互斥锁

### 1. 两种模式（Go 1.9+）

Go 的 Mutex 不是简单的阻塞队列，而是 **正常模式 + 饥饿模式** 的混合：

| 模式 | 机制 | 触发条件 |
|------|------|---------|
| **正常模式** | 自旋 4 次（`runtime_doSpin`）→ 挂起等待队列 | 默认状态 |
| **饥饿模式** | 新来 goroutine 直接排队，唤醒的 goroutine 直接获得锁 | 等待队列中 goroutine 等待超过 1ms |

**为什么有饥饿模式？** 正常模式下，被唤醒的 goroutine 要和新来的 goroutine 竞争，新来的在活跃 P 上更容易抢到锁，导致老 goroutine 一直抢不到。饥饿模式让被唤醒的 goroutine **直接获得锁**，新来的排队。

### 2. 自旋锁优化

```go
// 自旋条件（源码 runtime/mutex.go 类似逻辑）：
// 1. 多核 CPU
// 2. GOMAXPROCS > 1
// 3. 当前 P 的本地队列空（说明当前 goroutine 很快能释放锁）
// 4. 自旋次数 < 4（active_spin = 4）
```

自旋期间 CPU 在忙等，但**不切换 goroutine 上下文**，如果锁很快释放，比挂起-唤醒更快。

### 3. 复制检测

```go
type Mutex struct {
    state int32
    sema  uint32
}
```

Mutex 包含 `state` 和 `sema` 两个字段。如果 Mutex 被值传递（复制），两个副本的 `state` 不同步，会导致死锁或竞争。Go 通过 `vet` 工具检测 + 运行时 `copyChecker` 机制（比较第一次调用和当前地址）来报错。

### 4. 与 Channel 的取舍

| 场景 | 推荐 | 原因 |
|------|------|------|
| 保护共享状态 | Mutex | 语义直接，零分配 |
| 传递所有权/信号 | Channel | 避免显式锁，组合性好 |
| 复杂条件等待 | Channel 或 Cond | Mutex + 条件变量容易写错 |

---

## 二、`sync.RWMutex` — 读写锁

### 1. 底层计数器

```go
type RWMutex struct {
    w           Mutex        // 写锁互斥
    writerSem   uint32       // 写等待读完成
    readerSem   uint32       // 读等待写完成
    readerCount atomic.Int32 // 当前读锁数量（含等待写时的负值标记）
    readerWait  atomic.Int32 // 写锁等待的读 goroutine 数量
}
```

**核心逻辑**：
- 获取读锁：`readerCount++`，如果 `readerCount < 0` 说明有写锁在等，当前读要阻塞
- 获取写锁：先抢 `w`（互斥），然后 `readerCount -= rwmutexMaxReaders`（一个极大值，让后续读锁发现为负而阻塞），再等待已有读锁释放

### 2. 写锁饥饿问题

RWMutex **不解决写饥饿**。如果读锁频繁获取，写锁可能长期等待。解决方案：
- 用 Mutex 替代（读写都串行）
- 引入写锁优先逻辑（自定义实现）
- 控制读锁持有时间

### 3. 递归读锁死锁

```go
func bad() {
    rw.RLock()
    defer rw.RUnlock()
    
    // ❌ 同 goroutine 再次 RLock：readerCount 再加 1
    // 但写锁等待时，readerCount 为负，新 RLock 会阻塞
    // 如果此时写锁在等待，这里死锁
    rw.RLock()
    rw.RUnlock()
}
```

**Go 的 RWMutex 不支持递归（重入）**。同 goroutine 内嵌套 RLock 在特定条件下会死锁。

### 4. 锁升级/降级

**RWMutex 不支持锁升级**（读锁 → 写锁）和**锁降级**（写锁 → 读锁）。必须完全释放一个再获取另一个。

---

## 三、`sync.WaitGroup` — 等待组

### 1. 内部实现

```go
type WaitGroup struct {
    noCopy noCopy
    state1 [3]uint32 // 高 32 位: counter, 低 32 位: waiter 数量 + sema
}
```

- `counter`：未完成的 goroutine 数量
- `waiter`：调用 `Wait()` 阻塞的 goroutine 数量
- `sema`：信号量，用于阻塞/唤醒

### 2. 关键约束（面试必问）

| 约束 | 原因 |
|------|------|
| **Add 必须在 Wait 之前** | Wait 检查 counter 为 0 才返回，如果先 Wait 再 Add，可能永远等不到 |
| **Add 必须在 goroutine 启动前或内部第一时间** | 避免 Add 和 Done 的竞态 |
| **不能复制** | 复制后 counter 和 sema 状态分裂 |
| **Done 等价于 Add(-1)** | 内部就是 `Add(-1)` |

### 3. 常见错误模式

```go
// ❌ 错误：Add 在 goroutine 内部，但启动有延迟
for i := 0; i < 10; i++ {
    go func() {
        wg.Add(1) // 可能 goroutine 还没执行 Add，主 goroutine 已经 Wait 了
        defer wg.Done()
        work()
    }()
}
wg.Wait() // 可能 counter 还是 0，直接返回

// ✅ 正确：Add 在启动前
for i := 0; i < 10; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        work()
    }()
}
wg.Wait()
```

---

## 四、`sync.Once` — 单次执行

### 1. 内部实现（Go 1.21 前后差异）

```go
type Once struct {
    done atomic.Uint32
    m    Mutex
}

func (o *Once) Do(f func()) {
    if o.done.Load() == 0 {
        o.doSlow(f)
    }
}

func (o *Once) doSlow(f func()) {
    o.m.Lock()
    defer o.m.Unlock()
    if o.done.Load() == 0 {
        defer o.done.Store(1) // 即使 f panic，也标记为 done
        f()
    }
}
```

**关键设计**：
- 先 `atomic.Load` 快速路径（无锁），已执行过的直接返回
- 慢路径用 Mutex 保证只有一个 goroutine 执行 `f`
- `defer o.done.Store(1)`：**即使 `f` panic，也标记为 done**。Go 1.21 之前如果 `f` panic，`Once` 认为已经执行过，下次不再调用（可能留下未初始化状态）。

### 2. 为什么 `f` 是无参无返回值？

**设计哲学**：`Once` 只保证执行一次，不关心结果。如果需要结果，用闭包捕获：

```go
var once sync.Once
var conn *sql.DB
var err error

once.Do(func() {
    conn, err = sql.Open("postgres", dsn) // 闭包捕获外部变量
})
```

### 3. 不能用于参数化调用

```go
// ❌ 错误：想用 Once 控制不同参数
for _, url := range urls {
    var once sync.Once
    once.Do(func() {
        fetch(url) // 只执行第一个 url
    })
}
// 每个 url 应该独立 Once，或重新设计
```

---

## 五、`sync.Pool` — 对象池

### 1. 核心设计：每个 P 一个本地池

```go
type Pool struct {
    noCopy noCopy
    local     unsafe.Pointer // []*poolLocal
    localSize uintptr
    victim    unsafe.Pointer // 上一轮 GC 存活的对象
    victimSize uintptr
    New func() any
}
```

**无锁获取**：
1. 获取当前 P 的索引
2. 从 `poolLocal` 的 `private`（私有对象，无竞争）获取
3. 如果没有，从 `shared`（本地队列，无锁）获取
4. 如果还没有，从其他 P 的 `shared` 偷（steal）
5. 最后调用 `New`

### 2. 为什么 GC 会清空 Pool？

**设计原因**：`sync.Pool` 不是缓存，而是**对象复用池**。如果不清空，Pool 里的对象会成为 GC 的 root，导致：
- 对象无法被回收
- 内存泄漏风险

**策略**：
- 每轮 GC，把 `local` 移到 `victim`，把旧的 `victim` 清空
- 相当于对象有 **2 个 GC 周期** 的存活机会
- 如果在这期间没有被 Get，就被回收

### 3. 适合 vs 不适合

| 适合 | 不适合 |
|------|--------|
| 临时对象（`bytes.Buffer`、解码器） | 有状态对象（数据库连接、Session） |
| 高频创建/销毁、分配开销大 | 需要持久化生命周期 |
| 对象大小相近 | 对象大小差异巨大 |

### 4. 内存对齐陷阱

```go
type poolLocal struct {
    private any
    shared  poolChain
    pad     [128 - 8]byte // 防止 false sharing
}
```

每个 `poolLocal` 做了 **cache line padding**（通常 64 字节），防止不同 P 的 poolLocal 在同一个 cache line 上导致 false sharing。

---

## 六、`sync.Map` — 并发安全 Map

### 1. 内部结构：read + dirty 双写

```go
type Map struct {
    mu     Mutex
    read   atomic.Pointer[readOnly] // 只读 map，无锁访问
    dirty  map[any]*entry           // 读写 map，需要加锁
    misses int                      // read 未命中次数
}
```

```go
type readOnly struct {
    m       map[any]*entry
    amended bool // true 表示 dirty 有 read 中没有的 key
}
```

```go
type entry struct {
    p atomic.Pointer[any] // nil（已删除）/ expunged（已硬删除）/ 实际值
}
```

### 2. 读写流程

| 操作 | 路径 |
|------|------|
| **Load**（读） | 先读 `read`（atomic，无锁）→ 未命中则 `missLocked` → 读 `dirty`（加锁） |
| **Store**（写） | 如果 `read` 中有，CAS 更新（无锁）→ 否则加锁写 `dirty` |
| **Delete** | `read` 中有则 CAS 设 nil（软删除）→ 否则加锁从 `dirty` 删 |
| **Range** | 如果 `amended=true`，把 `dirty` 提升为 `read`（全量复制，加锁） |

### 3. 性能特征

- **读多写少**：大部分读走 `read` 无锁路径，性能极好
- **写多**：频繁加锁，且 `dirty` 提升开销大，性能可能不如 `map+Mutex`
- **key 类型**：`any`，但底层用 `==` 比较，所以只能用 comparable 类型

### 4. 什么时候用？

| 场景 | 推荐 |
|------|------|
| 读极多、写极少、key 类型统一 | `sync.Map` |
| 读写均衡、需要复杂操作（如 Len） | `map + sync.RWMutex` |
| 需要遍历、计数、快照 | `map + Mutex` |

---

## 七、`sync.Cond` — 条件变量

### 1. 核心 API

```go
type Cond struct {
    L Locker // 通常是 *Mutex 或 *RWMutex
    // ...
}

func (c *Cond) Wait()   // 释放 L，阻塞等待 Signal/Broadcast，然后重新获取 L
func (c *Cond) Signal() // 唤醒一个等待的 goroutine
func (c *Cond) Broadcast() // 唤醒所有等待的 goroutine
```

### 2. 使用模式

```go
c.L.Lock()
for !condition() { // 必须用 for，不能用 if
    c.Wait()       // 内部：Unlock → 阻塞 → 被唤醒 → Lock
}
// 使用条件
c.L.Unlock()
```

**为什么用 `for` 而不是 `if`？**
- `Wait` 被唤醒后，条件可能又不满足了（虚假唤醒、多个 goroutine 竞争）
- `for` 循环重新检查条件，保证正确性

### 3. 与 Channel 的对比

| | `sync.Cond` | `chan` |
|--|-------------|--------|
| 条件判断 | 任意复杂条件 | 只能判断 channel 是否 ready |
| 唤醒 | 精确控制（Signal 1 个 / Broadcast 全部） | 随机一个接收者 |
| 锁集成 | 必须与 Locker 配合 | 无锁，channel 本身同步 |
| 场景 | 复杂条件等待、资源池 | 简单事件通知、数据传递 |

---

## 八、`sync/atomic` — 原子操作

### 1. 操作类型

```go
// 整数类型（int32, int64, uint32, uint64, uintptr）
AddInt64(&x, 1)      // 返回新值
LoadInt64(&x)        // 读取
StoreInt64(&x, 5)    // 写入
SwapInt64(&x, 5)     // 交换，返回旧值
CompareAndSwapInt64(&x, old, new) // CAS

// 任意类型
var v atomic.Value
v.Store(anyValue)
val := v.Load() // 返回 any
```

### 2. `atomic.Value` 的限制

- `Store` 和 `Load` 的类型必须**一致**（第一次 Store 的类型决定了后续类型）
- 不能 Store `nil`
- 适合：配置热更新、单例对象的指针替换

### 3. 内存序保证

Go 的原子操作提供 **happens-before** 保证：
- `Store` → `Load` 有同步关系
- 但**不保证**非原子变量的可见性（除非用 `atomic` 做同步点）

```go
var a int
var flag atomic.Int32

// goroutine 1
a = 1
flag.Store(1)

// goroutine 2
if flag.Load() == 1 {
    // 这里能看到 a == 1，因为 Store/Load 建立了 happens-before
}
```

---

## 九、面试高频题速查

| 问题 | 答案 |
|------|------|
| Mutex 正常模式和饥饿模式？ | 正常：自旋+竞争；饥饿：唤醒者优先，新来排队。等待超 1ms 切饥饿模式 |
| RWMutex 同 goroutine 能 RLock 嵌套吗？ | 能执行，但写锁等待时会死锁。不支持重入 |
| WaitGroup Add 必须在 Wait 之前？ | 是。Wait 检查 counter，如果 Add 在 Wait 之后，可能永远等不到 |
| Once 的 f panic 了怎么办？ | Go 1.21+ 会记录 panic 并再次 panic；之前版本标记 done 不再执行，可能留下未初始化状态 |
| Pool 为什么 GC 清空？ | 避免对象成为 GC root 导致内存泄漏。victim 机制给 2 个 GC 周期存活机会 |
| sync.Map 的 dirty 提升？ | misses 超过 dirty 长度时，把 dirty 提升为 read，amended 设 false |
| Cond 的 Wait 为什么用 for？ | 处理虚假唤醒和竞争，确保条件真正满足 |
| atomic 和 Mutex 哪个快？ | atomic 无锁，通常更快，但只能保护单个变量。Mutex 保护代码块 |

需要我接下来展开哪个部分的源码级细节？比如 `sync.Map` 的 `entry.p` 的三种状态流转、`Mutex` 的 `state` 位图设计（`mutexLocked`/`mutexWoken`/`mutexStarving`/`mutexWaiterShift`）、或者 `Pool` 的 `poolDequeue` 无锁环形队列实现？