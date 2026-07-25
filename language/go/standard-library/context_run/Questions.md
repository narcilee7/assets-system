# Go `context` 深度全解：从 API 到源码到面试陷阱

## 一、核心接口：只有一个，但统治一切

```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)  // 返回截止时间，ok=false 表示无 deadline
    Done() <-chan struct{}                     // 返回只读 channel，取消时关闭
    Err() error                                // Done 关闭后返回原因：Canceled / DeadlineExceeded
    Value(key any) any                          // 键值查询
}
```

**关键认知**：`Context` 是**只读**的并发安全接口。所有修改操作（取消、设 deadline、加值）都返回**新的** Context。

---

## 二、六种创建方式与适用场景

| 函数 | 场景 | 是否可取消 | 是否带 deadline |
|------|------|-----------|----------------|
| `context.Background()` | main 函数、初始化、顶层调用 | ❌ | ❌ |
| `context.TODO()` | 占位、接口适配、不确定传什么 | ❌ | ❌ |
| `context.WithCancel(parent)` | 手动取消、级联控制 | ✅ | ❌ |
| `context.WithTimeout(parent, duration)` | 超时控制（相对时间） | ✅ | ✅ |
| `context.WithDeadline(parent, time)` | 超时控制（绝对时间） | ✅ | ✅ |
| `context.WithValue(parent, key, val)` | 请求元数据传递（traceID、userID 等） | ❌ | ❌ |

```go
// 典型超时链
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

// 进一步细化子操作
subCtx, subCancel := context.WithTimeout(ctx, 2*time.Second)
defer subCancel() // 子超时比父短，2s 后 subCtx 先取消
```

---

## 三、源码解剖：三种具体实现

### 1. `emptyCtx` — Background / TODO 的底层

```go
type emptyCtx struct{}

func (emptyCtx) Deadline() (time.Time, bool) { return time.Time{}, false }
func (emptyCtx) Done() <-chan struct{}       { return nil }  // nil channel 永远阻塞
func (emptyCtx) Err() error                  { return nil }
func (emptyCtx) Value(key any) any           { return nil }
```

**面试考点**：`nil channel` 读操作永远阻塞。所以 `<-ctx.Done()` 在 Background/TODO 上会**死锁**，必须配合 `select` 的 `default` 或检查 `ctx.Err()`。

### 2. `cancelCtx` — WithCancel 的核心

```go
type cancelCtx struct {
    Context                    // 嵌入 parent
    mu       sync.Mutex        // 保护 children
    done     atomic.Value      // 缓存 *channel，懒加载
    children map[canceler]struct{} // 所有子 cancelCtx
    err      error             // 取消原因
}
```

**取消传播机制**（面试必问）：

```go
func (c *cancelCtx) cancel(removeFromParent bool, err error) {
    c.mu.Lock()
    defer c.mu.Unlock()
    
    // 1. 幂等：已经取消则直接返回
    if c.err != nil { return }
    c.err = err
    
    // 2. 关闭 done channel（触发所有监听 goroutine）
    d, _ := c.done.Load().(chan struct{})
    if d == nil {
        c.done.Store(closedchan) // 预关闭的 channel
    } else {
        close(d)
    }
    
    // 3. 递归取消所有子节点
    for child := range c.children {
        child.cancel(false, err)
    }
    c.children = nil
    
    // 4. 从父节点的 children map 中移除自己
    if removeFromParent {
        removeChild(c.Context, c)
    }
}
```

**关键洞察**：
- 取消是**向下传播**的：父取消 → 所有子取消
- 取消是**单向**的：子取消**不会**影响父
- `children` 是 `map[canceler]struct{}`，子节点注册到父节点，形成**树形结构**

### 3. `timerCtx` — WithTimeout / WithDeadline

```go
type timerCtx struct {
    cancelCtx                  // 嵌入 cancelCtx，继承取消能力
    timer *time.Timer           // 超时定时器
    deadline time.Time          // 绝对截止时间
}
```

```go
func (c *timerCtx) cancel(removeFromParent bool, err error) {
    // 1. 停止定时器，释放资源
    c.timer.Stop()
    // 2. 调用 cancelCtx.cancel 传播取消
    c.cancelCtx.cancel(removeFromParent, err)
}
```

**面试陷阱**：`defer cancel()` 很重要。如果函数提前返回但 context 未取消，timer 会继续持有引用，导致**内存泄漏**。

### 4. `valueCtx` — WithValue

```go
type valueCtx struct {
    Context       // 父 context
    key, val any  // 当前键值对
}
```

```go
func (c *valueCtx) Value(key any) any {
    if c.key == key {
        return c.val
    }
    return c.Context.Value(key) // 递归向上查找
}
```

**关键特性**：
- **链式查找**：从当前节点向上递归，O(n) 复杂度
- **不可覆盖**：相同 key 在不同层级可以共存，查找时先命中最近的
- **key 建议用自定义非导出类型**：避免包间冲突

```go
// 最佳实践：用自定义类型作为 key
type contextKey string
const userIDKey contextKey = "userID"

ctx = context.WithValue(ctx, userIDKey, "123")
```

---

## 四、取消信号的底层：channel 关闭语义

```go
// 监听取消的标准模式
select {
case <-ctx.Done():
    // context 被取消
    err := ctx.Err()
    if err == context.Canceled {
        // 手动取消
    } else if err == context.DeadlineExceeded {
        // 超时
    }
    return
case result := <-work:
    // 正常完成
}
```

**为什么用 `close(channel)` 而不是发送值？**

1. **广播能力**：一个 channel 可以被多个 goroutine 监听，`close` 会唤醒所有接收方
2. **幂等性**：重复 `close` 会 panic，但 context 内部保证只 close 一次
3. **语义清晰**：`close` 表示"不再有任何数据"，完美对应"取消"语义

---

## 五、传播规则与生命周期

### 传播方向图

```
Background (根)
    │
    ├─► cancelCtx A (WithCancel)
    │       │
    │       ├─► cancelCtx A1 (WithCancel) ── 取消 A 会传播到 A1
    │       │       │
    │       │       └─► valueCtx A1.1 (WithValue)
    │       │
    │       └─► timerCtx A2 (WithTimeout) ── 取消 A 会传播到 A2，A2 超时也会自我取消
    │
    └─► cancelCtx B (WithCancel) ── 取消 A 不会影响 B
```

### 关键规则

| 规则 | 说明 |
|------|------|
| 父取消 → 子必取消 | 通过 `children` map 递归传播 |
| 子取消 → 父不受影响 | 子只从父的 children 中移除自己 |
| Deadline 继承 | 子 deadline 不能晚于父；如果父没 deadline，子自由设定 |
| Value 继承 | 子可以访问父的所有值，但父访问不到子的 |

---

## 六、使用规范与最佳实践

### 1. 参数位置惯例

```go
// ✅ 正确：ctx 作为第一个参数，命名 ctx
func Process(ctx context.Context, req *Request) error

// ❌ 错误：ctx 放中间或命名不规范
func Process(req *Request, c context.Context) error
```

### 2. 不要传可选参数

```go
// ❌ 错误：把可选配置塞进 context
ctx = context.WithValue(ctx, "timeout", 30)
ctx = context.WithValue(ctx, "retry", 3)

// ✅ 正确：context 只传请求作用域数据（traceID、userID），配置用显式参数
func Call(ctx context.Context, timeout time.Duration, retry int)
```

### 3. 不要传 nil context

```go
// ❌ 危险：nil context 的 Done() 返回 nil，select 会永远阻塞
func Bad(ctx context.Context) {
    select {
    case <-ctx.Done(): // 如果 ctx == nil，死锁
    }
}

// ✅ 防御：如果允许 nil，兜底用 Background
if ctx == nil {
    ctx = context.Background()
}
```

### 4. 必须 cancel 的场景

```go
// ✅ 必须 defer cancel，防止 goroutine 泄漏
ctx, cancel := context.WithCancel(parent)
defer cancel()

// ✅ 即使子函数提前返回，也要确保资源释放
func Query(ctx context.Context) error {
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()
    
    // 如果这里 return 了，cancel 会被调用，停止 timer
    return db.QueryContext(ctx, "SELECT ...")
}
```

### 5. 跨 API 边界传值

```go
// HTTP 请求链：traceID 贯穿所有层
func HTTPMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        traceID := r.Header.Get("X-Trace-ID")
        ctx := context.WithValue(r.Context(), traceIDKey, traceID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

---

## 七、高频面试题与深度答案

### Q1: `context.Background()` 和 `context.TODO()` 有什么区别？

**A**: 功能上**完全等价**，都是返回 `emptyCtx`。区别只在**语义**和**静态检查**：
- `Background`：明确表示这是顶层根 context，用于 main、init、测试根
- `TODO`：表示"暂时不知道传什么"，是重构占位符。lint 工具可以配置检测 TODO 的使用，提醒开发者后续替换

### Q2: 为什么 `context.WithValue` 的 key 建议用自定义类型？

**A**: 避免**键冲突**。Go 的 `any` 类型允许任何值作为 key。如果两个包都用字符串 `"userID"` 作为 key，会互相覆盖。用自定义非导出类型（如 `type key int`）可以保证包间隔离。

### Q3: 子 context 的 deadline 可以比父 context 长吗？

**A**: **可以创建，但无效**。`WithDeadline` 源码会检查：

```go
func WithDeadline(parent Context, d time.Time) (Context, CancelFunc) {
    if cur, ok := parent.Deadline(); ok && cur.Before(d) {
        // 父 deadline 更早，直接返回父的 cancelCtx
        return WithCancel(parent)
    }
    // ...
}
```

如果父 deadline 更早，子会直接退化成一个 `cancelCtx`（继承父的 deadline），不会创建新的 timer。

### Q4: `ctx.Done()` 返回的 channel 什么时候会被关闭？

**A**: 三种情况：
1. 调用 `cancel()`（手动或超时触发）
2. deadline 到达（`timerCtx` 的 timer 触发）
3. parent context 的 Done 被关闭（级联传播）

### Q5: 如何防止 goroutine 泄漏？

**A**: 确保所有 `WithCancel/WithTimeout/WithDeadline` 都有对应的 `cancel()` 调用。常见泄漏场景：

```go
// ❌ 泄漏：leak 函数里的 goroutine 永远阻塞在 <-ctx.Done()
func leak() {
    ctx, _ := context.WithCancel(context.Background()) // 没 cancel！
    go func() {
        <-ctx.Done()
        println("done")
    }()
}

// ✅ 修复
func fixed() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()
    go func() {
        <-ctx.Done()
        println("done")
    }()
}
```

### Q6: `select` 中 `ctx.Done()` 和另一个 channel 同时 ready，会选哪个？

**A**: Go 的 `select` 是**伪随机**选择所有 ready 的 case。如果 `ctx.Done()` 和业务 channel 同时 ready，不保证优先处理取消。如果要求"取消优先"，需要额外逻辑：

```go
select {
case <-ctx.Done():
    return ctx.Err()
case v := <-ch:
    // 处理 v
}

// 或者：先非阻塞检查 ctx
select {
case <-ctx.Done():
    return ctx.Err()
default:
}
select {
case v := <-ch:
    // 处理 v
}
```

### Q7: `http.Request.Context()` 是怎么工作的？

**A**: HTTP Server 每收到一个请求会创建一个 context，关联到该请求的生命周期：
- 客户端断开连接 → context 取消
- 服务端调用 `w.WriteHeader` 后不会取消，但 `http.Server` 的 `BaseContext` 和 `ConnContext` 可以自定义
- Handler 里通过 `r.Context()` 获取，通过 `r.WithContext()` 衍生

---

## 八、快速记忆卡片

```
接口：Deadline / Done / Err / Value
根节点：Background (正式) / TODO (占位)
创建：WithCancel / WithTimeout / WithDeadline / WithValue
实现：emptyCtx / cancelCtx / timerCtx / valueCtx
传播：父→子（取消向下），子→父（无影响）
规范：ctx 放第一参数、必 defer cancel、key 用自定义类型
```

需要我继续深挖某个具体点吗？比如 `http.Server` 的 context 集成、`grpc` 的 context 拦截器链、或者 `context` 的内存布局与 GC 影响？