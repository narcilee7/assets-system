# Go 运行时底层 & 内存模型 — 专家级面试总纲

---

## 一、运行时架构总览

Go Runtime 是 **self-hosted**（自包含、不依赖 libc）的运行时，核心职责：

| 模块 | 源码位置 | 职责 |
|------|---------|------|
| **调度器** | `runtime/proc.go` | G/M/P 管理、上下文切换、work stealing |
| **内存分配** | `runtime/malloc.go` / `mheap.go` / `mcache.go` | 分级分配、67 size classes、span 管理 |
| **GC** | `runtime/mgc.go` / `mgcmark.go` / `mgcsweep.go` | 三色标记、混合写屏障、并发清扫 |
| **栈管理** | `runtime/stack.go` | 连续栈、增长/收缩、栈拷贝 |
| **网络轮询** | `runtime/netpoll_*.go` | epoll/kqueue/IOCP、多路复用 |
| **系统调用** | `runtime/syscall_*.go` | handoff、阻塞管理 |

---

## 二、GMP 调度器（面试核心）

### 2.1 核心结构体

```go
// runtime/runtime2.go

type g struct {
    stack       stack          // 栈边界 {lo, hi}
    sched       gobuf          // 调度上下文：sp, pc, g, bp, lr
    atomicstatus uint32        // 状态：_Grunnable, _Grunning, _Gwaiting...
    goid        int64
    waitsince   int64          // 阻塞开始时间
    waitreason  waitReason     // 阻塞原因
    preempt     bool           // 抢占标记
    m           *m             // 绑定的 M
    schedlink   *g             // 全局 runq 链表
    // ...
}

type m struct {
    g0          *g             // 系统栈 goroutine（调度用）
    curg        *g             // 当前运行的 G
    p           puintptr       // 绑定的 P
    nextp       puintptr       // 待绑定的 P
    oldp        puintptr       // 阻塞前绑定的 P
    spinning    bool           // 是否自旋（找 work）
    lockedg     guintptr       // LockOSThread 绑定的 G
    // ...
}

type p struct {
    id          int32
    status      uint32         // _Pidle, _Prunning, _Psyscall...
    m           muintptr       // 绑定的 M
    mcache      *mcache        // 内存分配缓存（P 本地）
    runqhead    uint32         // 本地 runq 头
    runqtail    uint32         // 本地 runq 尾
    runq        [256]guintptr  // 本地可运行 G 队列（循环数组）
    runnext     guintptr       // 下一个优先运行的 G
    // ...
}
```

### 2.2 状态机

```
G 状态：
_Gidle → _Grunnable → _Grunning → _Gwaiting → _Grunnable → ...
                              ↓
                         _Gdead（退出）

P 状态：
_Pidle → _Prunning → _Psyscall → _Pidle
              ↓
         _Pgcstop（GC 时）

M 状态：
无显式状态，通过是否绑定 P、是否自旋区分
```

### 2.3 调度循环 `schedule()`

```go
// runtime/proc.go
func schedule() {
    _g_ := getg()
    
top:
    // 1. 每 61 次检查全局 runq，防止饥饿
    if gp == nil && _g_.m.p.ptr().schedtick%61 == 0 && sched.runqsize > 0 {
        gp = globrunqget(_g_.m.p.ptr(), 1)
    }
    
    // 2. 本地 runq
    if gp == nil {
        gp = runqget(_g_.m.p.ptr())
    }
    
    // 3. 全局 runq
    if gp == nil {
        gp = findrunnable()
    }
    
    // 4. 执行
    execute(gp, inheritTime)
}
```

### 2.4 Work Stealing

```go
// runtime/proc.go
func stealWork(now int64) *g {
    // 随机轮询其他 P，偷取一半 runq
    for i := 0; i < 4; i++ {  // 最多偷 4 次
        for enum := stealOrder.start(fastrand()); !enum.done(); enum.next() {
            p2 := allp[enum.position()]
            if p2 == pp {
                continue
            }
            // 偷 runq
            if gp := runqsteal(_g_.m.p.ptr(), p2, stealRunNextG); gp != nil {
                return gp
            }
            // 偷 timer
            // ...
        }
    }
    return nil
}
```

**面试要点**：
- 本地 runq 是 **256 长度的循环数组**，无锁访问（单生产者单消费者）。
- 全局 runq 需要 **锁**（`sched.lock`）。
- 偷取时一次搬 **一半**（批量搬运，减少竞争）。

### 2.5 Handoff（系统调用阻塞）

```
M 进入阻塞 syscall（如文件 IO）：
1. M 释放 P（p.m = nil, p.status = _Psyscall）
2. M 进入内核阻塞
3. sysmon 监控到 P 闲置过久，把 P 抢过来给其他 M
4. syscall 返回后，M 尝试 reclaim 原 P
   - 成功：继续
   - 失败：把 G 放回全局 runq，M 休眠（park）
```

### 2.6 Sysmon

```go
// runtime/proc.go
func sysmon() {
    for {
        // 1. 网络轮询（非阻塞）
        if netpollinited() && lastpoll != 0 && ... {
            gp := netpoll(0)
            injectglist(gp)
        }
        
        // 2. 抢占（Go 1.14+ 信号抢占）
        if retake(now) != 0 {
            // 强制 P 上的 G 让出
        }
        
        // 3. 强制 GC
        if gcphase != _GCoff && ... {
            gcTrigger()
        }
        
        usleep(20 * 1000)  // 20ms 间隔
    }
}
```

### 2.7 抢占机制演进

| 版本 | 机制 | 问题 |
|------|------|------|
| Go 1.1 | 协作式：函数调用时检查 `stackguard0` | 纯循环无函数调用则无法抢占 |
| Go 1.2 | 在循环中插入检查 | 仍无法抢占 tight loop |
| Go 1.14 | **信号抢占**：`SIGURG` | 任何指令位置都能被中断 |

**信号抢占实现**：
```go
// 1. sysmon 发现 G 运行超过 10ms
// 2. 向 M 发送 SIGURG
// 3. M 的信号处理函数设置 g.preempt = true
// 4. 在合适的安全点（函数入口、循环回边）检查并让出
```

---

## 三、内存分配器（面试次核心）

### 3.1 分级架构

```
对象大小分级：
┌─────────────┬──────────────┬──────────────────┐
│  微对象     │  小对象       │  大对象           │
│  < 16B      │  16B ~ 32KB   │  > 32KB           │
│  无头分配    │  size class   │  直接 mheap/OS    │
└─────────────┴──────────────┴──────────────────┘

分配路径：
Thread ──► mcache (P本地) ──► mcentral ──► mheap ──► OS
              │                 │
              ▼                 ▼
         无锁命中            需要锁
```

### 3.2 核心结构体

```go
// runtime/mheap.go
type mheap struct {
    lock      mutex
    free      mTreap        // 空闲 span 树
    scav      mTreap        // 已归还 OS 的 span
    allspans  []*mspan      // 所有 span
    // ...
}

// runtime/mcentral.go
type mcentral struct {
    lock      mutex
    spanclass spanClass     // 0-133（size + noscan 标记）
    nonempty  mSpanList     // 有空闲 object 的 span
    empty     mSpanList     // 无空闲或已全分配的 span
}

// runtime/mcache.go
type mcache struct {
    // 136 个 span 指针（68 size × 2 scan/noscan）
    alloc [numSpanClasses]*mspan
    tiny       uintptr       // 微对象分配器
    tinyoffset uintptr
    // ...
}

// runtime/mspan.go
type mspan struct {
    next       *mspan        // 链表
    prev       *mspan
    startAddr  uintptr       // 起始地址
    npages     uintptr       // 页数（8KB/页）
    allocBits  *gcBits       // 哪些 object 已分配
    gcmarkBits *gcBits       // GC 标记位图
    sweepgen   uint32        // 清扫代数
    // ...
}
```

### 3.3 Size Class

- **67 个 size classes**，覆盖 8B ~ 32KB。
- 每个 class 对应固定 object 大小（如 class 3 = 24B）。
- `mspan` 按 class 切分 object，用位图管理。

### 3.4 分配路径

```go
func mallocgc(size uintptr, typ *_type, needzero bool) unsafe.Pointer {
    // 1. 大对象（>32KB）
    if size >= maxSmallSize {
        return largeAlloc(size, needzero)
    }
    
    // 2. 微对象（<16B 且 无指针）
    if size < maxTinySize && ... {
        // 使用 mcache.tiny 合并分配
    }
    
    // 3. 小对象
    var sizeclass uint8
    // 查表得到 sizeclass
    spc := makeSpanClass(sizeclass, noscan)
    span := c.alloc[spc]  // mcache
    v := nextFreeFast(span)
    if v == 0 {
        v = c.nextFree(spc)  // 慢路径：mcache → mcentral → mheap
    }
    // ...
}
```

**面试要点**：
- `mcache` 绑定 P，**无锁分配**（单线程访问）。
- `mcentral` 需要锁，但按 size class 分散锁竞争。
- `mheap` 全局锁，大对象分配慢。

---

## 四、GC（三色标记 + 混合写屏障）

### 4.1 算法演进

| 版本 | 算法 | STW |
|------|------|-----|
| Go 1.0 | 标记-清扫 | 全程 STW |
| Go 1.3 | 并行标记 | 标记 STW |
| Go 1.5 | 并发标记 | 约 10-30ms STW |
| Go 1.8 | **混合写屏障** | 约 1ms STW |
| Go 1.14+ | 优化 | 亚毫秒级 |

### 4.2 三色标记

```
白色：未访问（可能垃圾）
灰色：已访问，但子对象未扫描
黑色：已访问，子对象已扫描

初始：所有对象白色
根扫描：栈、全局变量、寄存器 → 灰色
标记：灰色对象变黑色，子对象变灰色
      直到无灰色对象
清扫：白色对象回收
```

### 4.3 混合写屏障（Go 1.8+）

**问题**：并发标记时，用户 goroutine 修改指针，可能漏标。

**场景**：
```
标记前：A(黑) → B(白)
用户修改：A → B 删除，A → C 新增，C → B 新增
如果 C 是白色，B 漏标（因为 A 已黑，不会再扫描）
```

**解决方案**：
```go
// 写屏障伪代码
writePointer(slot, ptr):
    // 1. 标记旧值（ shade(slot) ）
    shade(*slot)      // 旧值变灰
    
    // 2. 标记新值
    shade(ptr)        // 新值变灰
    
    // 3. 写入
    *slot = ptr
```

**shade**：
- 如果对象白 → 灰：放入标记队列。
- 如果对象已黑/灰：无操作。

**面试要点**：
- 写屏障**不是回写屏障**（不阻止写入），而是**异步标记**。
- 写屏障只在 **GC 标记阶段** 开启。
- 栈上对象**无写屏障**（栈在 GC 开始时扫描为灰色，并发修改可能漏标 → 混合写屏障通过**重新扫描栈**或**栈屏障**解决）。

### 4.4 GC 触发与 Pacing

```go
// GC 触发条件
trigger = heap_live + heap_live * GOGC / 100

// 例如 GOGC=100, heap_live=100MB
// 目标：堆增长到 200MB 时触发 GC
```

**Pacing**：
- 目标：GC 在堆达到 `trigger` 时完成标记。
- 标记工作量与用户分配速率匹配。
- 通过 `gcController` 动态调整标记 goroutine 数量。

### 4.5 核心结构体

```go
// runtime/mgc.go
type gcWork struct {
    wbuf1, wbuf2 *workbuf  // 标记队列缓冲（无锁，本地）
}

// 全局标记队列
type work struct {
    full  uint64            // 满队列计数
    empty uint64            // 空队列计数
    wbufSpans struct {
        lock mutex
        free mSpanList
    }
}
```

---

## 五、栈管理

### 5.1 连续栈

```
初始栈：2KB（64位系统）
最大栈：1GB（64位）

栈增长：
1. 函数调用检查 stackguard0
2. 如果栈不足，调用 morestack
3. 分配新栈（2x 大小）
4. 旧栈数据 memcpy 到新栈
5. 调整栈指针，继续执行

栈收缩：
GC 时检查，如果栈使用率 < 1/4，收缩到 1/2
```

### 5.2 栈边界检查

```go
// 函数序言（prologue）
TEXT runtime·main(SB), NOSPLIT, $xxx
    MOVQ    (TLS), R14          // g
    LEAQ    -xxx(SP), R15
    CMPQ    R15, g_stackguard0(R14)
    JBE     morestack           // 栈溢出，需要增长
```

---

## 六、Netpoller & 系统调用

### 6.1 网络轮询器

```
Go 网络 IO 不是阻塞 M 的！

用户调用：
net.Read() → syscall.Read() → runtime.pollDesc.waitRead()

runtime：
1. 把 fd 注册到 epoll（Linux）/ kqueue（BSD）/ IOCP（Windows）
2. gopark() 挂起 G，M 去执行其他 G
3. sysmon / 网络轮询线程检测到 fd ready
4. 把 G 加入 runq，唤醒调度
```

### 6.2 核心结构

```go
// runtime/netpoll.go
type pollDesc struct {
    link *pollDesc          // 链表
    fd   uintptr
    rseq uintptr            // 读序列号（防止竞态）
    rg   guintptr           // 等待读的 G
    rd   int32              // 读 deadline
    wseq uintptr
    wg   guintptr           // 等待写的 G
    wd   int32
    // ...
}
```

---

## 七、面试题集

### 题 1：GMP 调度

**问**：一个 Goroutine 从创建到执行，经历了哪些状态？`runnext` 的作用是什么？如果本地 runq 满了，新 G 会去哪？

**答**：
1. `newproc` → `_Gidle` → 初始化栈和上下文 → `_Grunnable`
2. 尝试放入当前 P 的 `runnext`（直接执行，无锁）
3. `runnext` 已有值，放入本地 runq
4. 本地 runq 满（256），放一半到全局 runq（`runqputslow`）
5. 调度器 `schedule()` 从 `runnext` → 本地 runq → 全局 runq → 网络轮询 → work stealing 找 G

`runnext`：优先级队列，下一个执行的 G，**无锁直接替换**，减少调度延迟。

---

### 题 2：GC 写屏障

**问**：混合写屏障为什么需要标记**旧值**和**新值**？如果只标记新值，会出现什么问题？

**答**：
- 只标记新值：如果删除 A→B，新增 C→B，但 C 是白色，B 可能漏标。
- 标记旧值：确保被删除引用的对象（B）如果被其他白色对象引用，不会漏标。
- 实际上 Go 1.8 的混合写屏障是 **"标记新值 + 栈重新扫描"** 的组合，旧值标记在特定场景下使用。

**追问**：栈上为什么没有写屏障？如何解决栈的漏标？

**答**：
- 栈上写屏障成本太高（栈访问频繁）。
- 解决方案：GC 开始时**扫描所有栈为灰色**，标记阶段**不重新扫描栈**（Go 1.8 之前需要 STW 重新扫描栈）。
- 混合写屏障保证：即使栈上指针修改导致漏标，通过**对象着色**保证黑色对象不指向白色对象。

---

### 题 3：内存分配

**问**：`make([]int, 100)` 和 `new([100]int)` 在内存分配上有何区别？`mcache` 的 `tiny` 分配器是什么？

**答**：
- `make([]int, 100)`：分配 **24 bytes header（栈或堆）** + **800 bytes 数组（堆）**。如果切片不逃逸，header 在栈。
- `new([100]int)`：分配 **800 bytes 数组**，返回指针。
- `tiny`：微对象（<16B）分配器，合并多个小对象到一个 16B 块，减少碎片。

---

### 题 4：栈与抢占

**问**：Go 1.14 的信号抢占，信号处理函数能直接切换 G 吗？为什么需要"安全点"？

**答**：
- **不能直接切换**。信号处理函数设置 `g.preempt = true`。
- 在**安全点**（函数入口、循环回边、栈增长检查点）检查 `preempt` 标志，主动调用 `gopreempt_m`。
- 原因：任意位置切换可能导致**不一致的寄存器状态**、**正在执行的指令序列被中断**。

---

### 题 5：运行时与系统调用

**问**：`cgo` 调用 C 函数时，M 会阻塞吗？`LockOSThread` 的用途和代价？

**答**：
- `cgo` 调用：M 进入 C 代码，**不阻塞**（但 C 代码执行时 M 不能调度其他 G）。
- 如果 C 代码阻塞（如 sleep），M 不会释放 P，导致 P 闲置。
- `LockOSThread`：G 绑定到当前 M，M 绑定到 OS 线程。用于需要线程本地状态的场景（如 OpenGL、某些系统调用）。
- 代价：该 M 只能运行这个 G，调度灵活性丧失。

---

## 运行时速查卡

| 模块 | 核心机制 | 面试高频 |
|------|---------|----------|
| **GMP** | P 本地 runq + 全局 runq + work stealing | 调度循环、handoff、sysmon |
| **抢占** | Go 1.14 `SIGURG` + 安全点检查 | 与协作式对比、为什么需要安全点 |
| **内存** | mcache → mcentral → mheap、67 size classes | 微对象、大对象路径、无锁分配 |
| **GC** | 三色标记 + 混合写屏障 + Pacing | 写屏障原理、STW 时间、GOGC 含义 |
| **栈** | 连续栈、2x 扩容、1/2 收缩 | 栈拷贝、栈溢出检查、最大栈大小 |
| **Netpoll** | epoll + gopark + injectglist | 为什么网络 IO 不阻塞 M、与阻塞 syscall 区别 |

---

**下一个模块？** `sync` 包源码（Mutex 的公平性、RWMutex 的饥饿问题、Map 的 read/amended 机制）？还是 **Go 编译器与链接器**（SSA、逃逸分析、内联、build tag）？