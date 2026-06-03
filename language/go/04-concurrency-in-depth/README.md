# Go 并发编程深度解析

这一层不仅讲「怎么用 goroutine/channel」，而是讲「并发模型背后的原理、工程陷阱、性能调优」。

---

## 1. CSP 模型与 Go 的实现

### 1.1 CSP 理论

- **CSP**（Communicating Sequential Processes）— Hoare, 1978
- 核心思想：并发实体通过**通信**交换信息，而非共享内存
- Go 的 CSP 变体：channel 是 typed，goroutine 没有显式命名

### 1.2 Go 的两条并发格言

> "Do not communicate by sharing memory; instead, share memory by communicating."

但 Go 也提供 `sync` 包共享内存原语。工程上：**channel 用于编排，mutex 用于保护状态**。

## 2. Goroutine 生命周期管理

### 2.1 创建与退出

```go
// 创建
go func() { ... }()

// 优雅退出：通过 channel / context / WaitGroup
```

### 2.2 泄漏检测

goroutine 泄漏的常见原因：
- 向无缓冲 channel send，但没有 receiver
- 从 channel receive，但 sender 已退出
- 无限循环中阻塞在 I/O
- 使用 `time.After` 在循环中不释放 timer

检测方法：
```bash
go test -race ./...
# 或运行时检查：runtime.NumGoroutine()
```

### 2.3 数量控制

- 无限制创建 goroutine 会 OOM（百万级 goroutine 约 2GB+ 内存）
- 使用 **worker pool** 或 **semaphore** 限制并发度

## 3. Channel 深度剖析

### 3.1 内部结构

```go
type hchan struct {
    qcount   uint           // 队列中元素数量
    dataqsiz uint           // 环形队列大小
    buf      unsafe.Pointer // 环形队列指针
    elemsize uint16
    closed   uint32
    elemtype *_type
    sendx    uint           // send 索引
    recvx    uint           // receive 索引
    recvq    waitq          // 等待接收的 sudog 链表
    sendq    waitq          // 等待发送的 sudog 链表
    lock     mutex
}
```

### 3.2 操作语义

| 操作 | channel 状态 | 结果 |
|------|-------------|------|
| send | nil | 永久阻塞 |
| send | 未关闭，有缓冲未满 | 写入缓冲区 |
| send | 未关闭，无缓冲/满 | 阻塞，加入 sendq |
| send | 已关闭 | panic |
| receive | nil | 永久阻塞 |
| receive | 未关闭，有数据 | 读取 |
| receive | 未关闭，无数据 | 阻塞，加入 recvq |
| receive | 已关闭，有数据 | 读取剩余数据 |
| receive | 已关闭，无数据 | 返回零值 + false |
| close | nil | panic |
| close | 已关闭 | panic |
| close | 未关闭 | 关闭，唤醒 recvq |

### 3.3 关闭原则

- **只有 sender 应该关闭 channel**（或明确的协调者）
- 从已关闭 channel 读取：安全，返回零值
- 向已关闭 channel 写入：panic

### 3.4 `nil channel` 技巧

```go
// 用 nil channel 在 select 中禁用某个 case
var ch chan int
select {
case <-ch:      // 永远阻塞，这个 case 不会被选中
case <-other:   // 只会走这里
}
```

## 4. Select 多路复用

### 4.1 实现机制

- 编译器将 select 转换为 `runtime.selectgo` 调用
- 随机化 case 执行顺序，防止饥饿
- 如果所有 case 都阻塞，select 挂起当前 G
- `default` case 使 select 变为非阻塞

### 4.2 常见模式

```go
// 超时
select {
case result := <-ch:
case <-time.After(timeout):
}

// 取消
select {
case <-ctx.Done():
case result := <-ch:
}

// 非阻塞发送/接收
select {
case ch <- value:
default:
}
```

### 4.3 `time.After` 泄漏问题

```go
// ❌ 每次循环都创建新 timer，旧 timer 到时间后发送值但无人接收
for {
    select {
    case <-time.After(1 * time.Second):
    }
}

// ✅ 使用 time.NewTimer + Reset
 timer := time.NewTimer(1 * time.Second)
 for {
     select {
     case <-timer.C:
         timer.Reset(1 * time.Second)
     }
 }
 ```

 ## 5. Context 传播机制

 ### 5.1 Context 树

 ```
 context.Background()
 ├── WithCancel() ──→ cancel()
 ├── WithTimeout() ──→ 自动 cancel（超时）
 ├── WithDeadline() ──→ 自动 cancel（绝对时间）
 └── WithValue() ──→ key-value（不建议用于业务参数）
 ```

 ### 5.2 使用原则

 - Context 应该作为函数**第一个参数**（约定 `ctx context.Context`）
 - 不要存储在 struct 中，应该显式传递
 - `WithValue` 只用于**请求范围元数据**（trace ID、user ID），不用于业务参数
 - 取消信号向下传播，不要跨边界向上传递

 ### 5.3 实现原理

 - `cancelCtx` 维护子 context 链表
 - `cancel()` 递归取消所有子节点
 - `timerCtx` 封装 `time.Timer` 触发自动 cancel

 ## 6. Sync 原语深度解析

 ### 6.1 Mutex

 - 正常模式：FIFO 等待队列，新来 goroutine 有抢锁机会
 - 饥饿模式：等待 > 1ms 的 goroutine 直接获得锁
 - `RWMutex`：读多写少场景，注意写饥饿问题

 ### 6.2 WaitGroup

 ```go
 var wg sync.WaitGroup
 wg.Add(1)
 go func() {
     defer wg.Done()
     // work
 }()
 wg.Wait()
 ```

 - `Add` 必须在 `Wait` 之前
 - `Done` 不能多于 `Add`，否则 panic

 ### 6.3 Once

 ```go
 var once sync.Once
 once.Do(func() {
     // 只执行一次，无论多少个 goroutine 调用
 })
 ```

 - 即使 `Do` 的函数 panic，也认为执行过了（不会重试）

 ### 6.4 Pool

 ```go
 var pool = sync.Pool{
     New: func() interface{} { return make([]byte, 1024) },
 }
 ```

 - 对象池，减少 GC 压力
 - 不保证 Get 返回的对象存在
 - GC 时会清空 Pool 中的对象

 ### 6.5 Map

 ```go
 var m sync.Map
 m.Store("key", value)
 v, ok := m.Load("key")
 ```

 - 针对两种场景优化：读多写少、多个 key 分散在不同 shard
 - 普通 map + RWMutex 在大部分场景更快

 ### 6.6 Cond

 ```go
 var mu sync.Mutex
 cond := sync.NewCond(&mu)
 cond.Wait()    // 释放锁，等待信号
 cond.Signal()  // 唤醒一个等待者
 cond.Broadcast() // 唤醒所有等待者
 ```

 - 用于复杂的等待/通知场景
 - 现代 Go 代码中较少使用，channel 通常更简洁

 ## 7. 并发模式与反模式

 ### 7.1 模式

 | 模式 | 场景 |
 |------|------|
 | Fan-out / Fan-in | 任务分发与结果聚合 |
 | Pipeline | 数据流处理 |
 | Worker Pool | 限制并发度 |
 | Semaphore | 资源配额控制 |
 | Errgroup | 并发任务+错误收集 |

 ### 7.2 反模式

 | 反模式 | 问题 |
 |--------|------|
 | 在循环中直接 go func 使用循环变量 | 闭包捕获引用，全部使用最后一个值 |
 | 不处理 goroutine 错误 | 静默失败，无法感知 |
 | 无限制创建 goroutine | OOM、调度开销 |
 | 在 select 中漏掉 ctx.Done() | 无法响应取消 |
 | 用 mutex 保护 channel 操作 | channel 本身已有同步语义 |

 ## 8. 竞态检测与调试

 ```bash
 go test -race ./...
 go run -race ./...
 ```

 - `-race` 编译时注入检测代码，运行时有 5-10x 性能开销
 - 检测：非同步的读写、读写同一地址无 happens-before

 ## 9. 性能调优

 | 技巧 | 效果 |
 |------|------|
 | 带缓冲 channel | 减少阻塞切换 |
 | `sync.Pool` | 减少堆分配 |
 | 对象复用 | 减轻 GC |
 | 避免不必要的 goroutine | 降低调度开销 |
 | 批处理 | 摊平 channel 操作开销 |
 | 锁粒度细化 | 减少竞争 |
 | `RWMutex` → 分片锁 | 高并发读场景 |
