# Go 内存模型与运行时底层

这一层深入 Go 的「黑盒」：内存如何分配、垃圾如何回收、goroutine 如何调度、代码如何与硬件交互。

---

## 1. 内存分配器（Allocator）

### 1.1 内存层级

```
OS
├── Heap（堆）
│   ├── Tiny对象（<16B）— 合并分配
│   ├── Small对象（16B~32KB）— span 分配
│   └── Large对象（>32KB）— 直接分配
├── Stack（栈）
│   └── goroutine 私有栈，动态扩缩容
└── Data/BSS段
    ├── 全局变量
    └── 零值初始化的变量
```

### 1.2 TCMalloc 风格的分配策略

- **mspan**：相同大小类的内存块集合
- **mcentral**：中心缓存，按 span class 分类
- **mcache**：每个 P 的本地缓存，无锁分配
- **mheap**：全局堆，大对象分配和 span 管理

### 1.3 栈管理

- goroutine 初始栈 2KB
- 连续栈（contiguous stack）：扩容时复制到新的大栈
- 栈分裂标记（stack guard）检测溢出
- 为什么栈上分配更快？—— 只需要移动栈指针

## 2. 逃逸分析（Escape Analysis）

### 2.1 什么导致逃逸？

| 场景 | 原因 |
|------|------|
| 返回局部变量指针 | 函数返回后栈帧回收，指针必须活到堆上 |
| interface 装箱 | 接口值持有具体值的指针 |
| channel/send | 值需要跨 goroutine 存活 |
| 闭包引用局部变量 | 变量生命周期超出函数 |
| slice/map 扩容 | 底层数组重新分配到堆 |
| 调用 `reflect.ValueOf` | 反射需要堆分配 |

### 2.2 如何分析？

```bash
go build -gcflags="-m -m" ./...
```

### 2.3 优化策略

- 减少不必要的指针
- 避免在热路径中 interface 装箱
- 预分配 slice/map 容量
- 值接收者减少堆分配

## 3. 垃圾回收（GC）

### 3.1 三色标记-清除

```
1. STW（Stop The World）：启动标记，扫描根对象
2. 并发标记：用户代码与标记并行
3. 混合写屏障（hybrid write barrier）：防止并发时漏标
4. 扫描栈：重新扫描 goroutine 栈
5. 清除：回收未标记对象（并发进行）
```

### 3.2 写屏障（Write Barrier）

- Go 1.8 前：Dijkstra 插入写屏障 + STW 重新扫描栈
- Go 1.8+：混合写屏障（Yuasa 删除 + Dijkstra 插入）
- 为什么需要写屏障？—— 防止 mutator 修改对象图时破坏标记一致性

### 3.3 GC 调优参数

| 参数 | 含义 |
|------|------|
| `GOGC` | 触发 GC 的堆增长百分比（默认 100） |
| `GOMEMLIMIT` | 软内存上限（Go 1.19+） |
| `runtime.SetGCPercent` | 运行时调整 GOGC |

### 3.4 GC 暂停时间

- Go 1.5：~10ms
- Go 1.8：亚毫秒级
- 目标：P99 暂停 < 100μs

## 4. Goroutine 调度器（GMP）

### 4.1 GMP 模型

```
G（Goroutine）— 用户态轻量线程，~2KB 初始栈
M（Machine）— OS 线程，执行 G 的载体
P（Processor）— 逻辑处理器，持有本地运行队列
```

### 4.2 调度策略

- **Work Stealing**：P 的本地队列为空时，从其他 P 偷取 G
- **Handoff**：系统调用阻塞时，M 释放 P，新 M 接管 P
- **Preemption**：Go 1.14+ 基于信号的协作式抢占

### 4.3 调度流程

```
1. go func() 创建 G
2. G 加入当前 P 的本地队列（runnext / runq）
3. M 从 P 获取 G 执行
4. G 阻塞（channel/syscall）→ M 切换执行其他 G
5. G 就绪 → 放入全局队列或其他 P 的队列
6. G 退出 → M 继续调度
```

### 4.4 系统调用与网络轮询

- 阻塞系统调用：M 阻塞，P 与其他 M 绑定（handoff）
- 网络 I/O：netpoller（epoll/kqueue/IOCP），非阻塞，G 放入 netpoll，就绪后重新调度
- `runtime.GOMAXPROCS` 控制 P 数量，默认等于 CPU 核数

## 5. 内存模型（Memory Model）

### 5.1 Happens-Before

Go 内存模型定义了哪些操作之间存在 happens-before 关系：

- goroutine 内：程序顺序 happens-before
- `go` 语句：go 之前的操作 happens-before goroutine 内操作
- channel send happens-before 对应的 receive
- `sync.Mutex`/`RWMutex`：Unlock happens-before 后续的 Lock
- `sync.WaitGroup`：Wait 等待之前所有 Add/Done
- `sync.Once`：Do 的 f 执行 happens-before 任何后续 Do 返回
- `atomic`：顺序一致性（sequentially consistent）

### 5.2 没有 happens-before 就是数据竞争

```go
// 数据竞争！没有同步原语
var a int
go func() { a = 1 }()
fmt.Println(a)
```

### 5.3 编译器重排序与内存屏障

- Go 编译器和 CPU 都可能重排序指令
- `sync/atomic` 提供内存序保证
- 普通变量读写不提供任何同步保证

## 6. 运行时内部数据结构

### 6.1 `runtime.g` 结构（goroutine 描述符）

包含栈信息、调度状态、defer 链表、panic 链表、labels 等。

### 6.2 `runtime.m` 结构（OS 线程描述符）

包含 g0（调度栈）、curg（当前 G）、信号处理等。

### 6.3 `runtime.p` 结构（逻辑处理器）

包含本地队列、mcache、defer 池、 sudog 缓存等。

## 7. `unsafe` 包与底层操作

### 7.1 合法使用场景

- `unsafe.Sizeof`、`unsafe.Alignof`、`unsafe.Offsetof`：标准工具
- 字符串与 `[]byte` 零拷贝转换
- 与 C 代码/CGO 交互
- 高性能序列化库（如 protobuf）

### 7.2 危险操作

- 指针算术：`unsafe.Pointer` → `uintptr` → 算术 → `unsafe.Pointer`
- `uintptr` 不是指针类型，GC 不会追踪
- `unsafe.Slice`：从指针创建 slice，越界访问 = UB

### 7.3 字符串零拷贝转换示例

```go
func StringToBytes(s string) []byte {
    return unsafe.Slice(unsafe.StringData(s), len(s))
}
```

⚠️ 必须确保原字符串生命周期覆盖 byte slice 使用期。

## 8. 推荐阅读

- *Go 语言设计与实现*（draveness）— 内存分配、GC、调度章节
- Go 内存模型官方文档：https://go.dev/ref/mem
- Go 运行时源码：`src/runtime/` 目录
