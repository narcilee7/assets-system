# Process vs Thread

## 目标

理解进程和线程的本质区别：隔离边界、资源共享、上下文切换成本，以及在实际工程中如何选型。

## 场景

- 为什么多线程比多进程共享数据更快？
- 什么场景必须用多进程（隔离性需求）？
- 线程切换为什么比进程切换快？
- goroutine / coroutine 和内核线程的区别？

## 进程（Process）

### 定义

```
进程 = 资源分配的基本单位

资源集合：
  - 独立的地址空间（虚拟内存）
  - 打开的文件描述符表
  - 信号处理表
  - 代码 / 数据 / 堆 / 栈
```

### 进程控制块（PCB）

```
struct task_struct (Linux) {
  pid, ppid
  mm_struct *mm          // 内存描述符（地址空间）
  files_struct *files    // 打开文件表
  signal_struct *signal  // 信号处理
  struct list_head tasks // 链表，用于调度
  cputime_t utime, stime // 用户态/内核态 CPU 时间
}
```

### 进程创建

```c
// fork()：复制父进程的地址空间（copy-on-write）
pid_t pid = fork();
if (pid == 0) {
    // 子进程
    execlp("ls", "ls", "-la", NULL);
} else {
    // 父进程
    waitpid(pid, &status, 0);
}
```

```
fork() 开销：
  1. 复制 PCB
  2. 复制页表（虚拟内存映射）
  3. 复制文件描述符表（引用计数 +1）
  4. 标记内存为 COW（实际内存页延迟复制）
```

## 线程（Thread）

### 定义

```
线程 = CPU 调度的基本单位

同一进程内的线程共享：
  - 地址空间（代码、数据、堆）
  - 打开的文件描述符
  - 信号处理

每个线程私有：
  - 栈（通常 8MB 默认，可配置）
  - 寄存器（PC、SP、通用寄存器）
  - 线程本地存储（TLS）
  - errno / 调度优先级
```

### 线程控制块（TCB）

```
struct thread_info {
  struct task_struct *task
  unsigned long flags
  __u32 cpu              // 当前运行的 CPU
  __s32 preempt_count    // 抢占计数
  mm_segment_t addr_limit
  // 寄存器状态在 kernel stack 上保存
}
```

### 线程创建

```c
// POSIX threads
pthread_t tid;
pthread_create(&tid, NULL, thread_func, arg);
pthread_join(tid, NULL);
```

## 进程 vs 线程 对比

| 维度 | 进程 | 线程 |
|---|---|---|
| 地址空间 | 独立 | 共享 |
| 通信方式 | IPC（pipe、shm、socket） | 直接读写共享内存 |
| 切换开销 | 高（需切换页表、TLB flush） | 低（只需切换寄存器、栈） |
| 创建开销 | 高（复制地址空间描述符） | 低（共享地址空间） |
| 崩溃影响 | 不影响其他进程 | 可能导致整个进程崩溃 |
| 调度单位 | 是 | 是 |
| 资源占用 | 大（每个进程独立地址空间） | 小（共享大部分资源） |

## 上下文切换（Context Switch）

### 进程切换

```
1. 保存当前进程的寄存器状态到 PCB
2. 切换页表（cr3 寄存器）→ TLB flush
3. 切换内核栈
4. 加载新进程的寄存器状态
5. 跳转到新进程的 PC

开销来源：
  - TLB flush：后续内存访问都要走页表遍历（慢）
  - cache 污染：新进程的 working set 不同
  - 实际开销：1μs ~ 10μs（取决于硬件）
```

### 线程切换

```
1. 保存当前线程的寄存器（PC、SP、通用寄存器）
2. 切换栈指针到新线程的栈
3. 加载新线程的寄存器
4. 跳转到新线程的 PC

优势：
  - 不需要切换页表（同一地址空间）
  - TLB 保持有效
  - 实际开销：100ns ~ 1μs
```

### 切换的触发时机

```
自愿切换（voluntary）：
  - 调用 sleep、wait、read/write 阻塞
  - 调用 sched_yield()

非自愿切换（involuntary / preempt）：
  - 时间片用完（CFS vruntime 超过）
  - 更高优先级线程就绪
  - 中断处理完成时检查 need_resched
```

## 用户态线程模型

### 1:1 模型（Kernel-Level Thread）

```
每个用户线程对应一个内核线程
Linux pthread、Windows thread、Java Thread

优点：
  - 真正的并行（多核利用）
  - 阻塞系统调用只阻塞当前线程

缺点：
  - 创建成本高（涉及内核）
  - 数量受限（内核资源）
```

### N:1 模型（User-Level Thread）

```
多个用户线程映射到一个内核线程
早期 Green Thread、Python asyncio（单线程）

优点：
  - 切换在用户态完成，极快
  - 可创建大量线程

缺点：
  - 无法利用多核
  - 一个线程阻塞，所有线程阻塞
```

### M:N 模型（Hybrid）

```
M 个用户线程映射到 N 个内核线程
Go goroutine、Erlang process、Java Virtual Thread

实现：
  - 用户态调度器（Go scheduler）把 goroutine 分到 OS thread
  - 阻塞时，goroutine 从 OS thread 脱离，OS thread 继续运行其他 goroutine

优点：
  - 轻量（goroutine 初始栈 2KB）
  - 高并发（百万级 goroutine）
  - 真正的并行（多 OS thread）
```

## L2：Linux 调度器源码与上下文切换机制

### CFS（Completely Fair Scheduler）核心源码

```c
// kernel/sched/fair.c: update_curr()
// CFS 的核心：更新当前任务的 vruntime
static void update_curr(struct cfs_rq *cfs_rq) {
    struct sched_entity *curr = cfs_rq->curr;
    u64 now = rq_clock_task(rq_of(cfs_rq));
    u64 delta_exec;
    
    delta_exec = now - curr->exec_start;  // 本次运行时间
    curr->exec_start = now;
    
    curr->vruntime += calc_delta_fair(delta_exec, curr);  // vruntime += delta / weight
}
```

**vruntime 的本质**：
- 虚拟运行时间，用于衡量"谁欠了 CPU 时间"。
- `weight` 与 `nice` 值相关：nice=-20（高优先级）weight=88761；nice=19（低优先级）weight=15。
- CFS 总是选择 `vruntime` 最小的任务运行。

### `context_switch()` 源码路径

```c
// kernel/sched/core.c: context_switch()
static __always_inline struct rq *context_switch(struct rq *rq,
        struct task_struct *prev, struct task_struct *next) {
    // 1. 切换 mm_struct（地址空间）
    if (!next->mm) {  // 内核线程
        next->active_mm = prev->active_mm;
    } else {
        switch_mm_irqs_off(prev->active_mm, next->mm, next);  // 写 cr3，触发 TLB flush
    }
    
    // 2. 切换寄存器状态（架构相关）
    switch_to(prev, next, prev);  // 汇编实现，保存/恢复通用寄存器、PC、SP
    
    barrier();
    return finish_task_switch(prev);
}
```

**关键开销来源**：
1. **`switch_mm_irqs_off`**：切换页表（cr3 寄存器）→ TLB flush。
   - x86-64 有 PCID（Process Context ID），可避免 TLB flush，但旧内核/硬件不支持。
2. **`switch_to`**：保存/恢复 16 个通用寄存器 + RSP + RIP + RFLAGS。
   - x86-64: ~100-200 个时钟周期（~50-100ns）。
3. **cache 污染**：新任务的 working set 和旧任务不同，导致 L1/L2 cache miss 增加。

### 数字锚定：上下文切换开销

| 切换类型 | 典型延迟 | 测试方法 |
|---|---|---|
| 进程切换（不同地址空间） | ~1-3 μs | `lmbench lat_ctx` / pipe ping-pong |
| 线程切换（同地址空间） | ~0.5-1.5 μs | `futex` ping-pong / condition variable |
| 协程切换（用户态） | ~50-200 ns | Go `chan` ping-pong / asyncio Queue |
| 中断进入/退出 | ~0.5-1 μs | `perf` 采样 `entry_SYSCALL_64` |

**进程 vs 线程切换差异**：
- 线程切换不需要 `switch_mm`，省下了 TLB flush 开销。
- 但 Linux 中线程也是 `task_struct`，调度路径完全相同。
- 差异主要来自是否切换页表。

### Go Goroutine Scheduler 对比

```go
// runtime/proc.go: schedule()
// Go 的 M:N 调度器
func schedule() {
    gp := findRunnable()  // 从全局/本地 runqueue 找可运行 goroutine
    execute(gp)           // 切换到 goroutine 上下文
}

// 切换开销：保存 3 个寄存器（PC, SP, DX）+ 栈指针切换
// 比内核线程切换快 10-50 倍
```

### 边界陷阱

1. **`fork()` 后 `exec()` 前的时间窗口**：如果子进程在 `exec()` 前收到信号，信号处理函数可能在父进程的地址空间中运行，造成意外行为。
2. **`CLONE_VM` 但不 `CLONE_FS`**：线程共享地址空间但各自有当前工作目录，一个线程 `chdir()` 不影响其他线程（Linux 线程实现细节）。
3. **线程栈溢出**：默认 8MB 栈，递归深度过大时栈溢出没有优雅错误，直接 SIGSEGV。

## L3：可运行实验

见 `impl/process_thread_lab/`：

```bash
cd systems-engineering/operating-systems/impl/process_thread_lab
python3 context_switch_bench.py --mode all
```

实验覆盖：
- 进程创建 vs 线程创建 vs 协程创建的延迟对比
- 进程/线程/协程的上下文切换开销对比（pipe ping-pong、condition variable、asyncio Queue）

预期输出：
- 进程创建 ≈ 线程创建 × 10-50
- 线程创建 ≈ 协程创建 × 10-100
- 线程上下文切换 ≈ 协程上下文切换 × 5-20

## 核心追问

1. **fork() 后父子进程写同一变量会发生什么？** 触发 copy-on-write，物理页复制，各自独立
2. **为什么线程崩溃会导致整个进程退出？** 线程共享地址空间，一个线程踩坏堆栈或触发 segfault，SIGSEGV 发送到整个进程
3. **TLB flush 为什么慢？** 切换页表后所有虚拟地址缓存失效，后续内存访问都要查页表（多一次内存访问）
4. **goroutine 为什么比线程轻量？** 初始栈 2KB（线程 8MB），用户态调度，上下文切换只需改几个寄存器
5. **多进程通信为什么比多线程慢？** 需要内核介入（pipe/socket），数据需要拷贝；线程直接读写共享内存

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| process vs thread notes | **L2+L3** | **done** |
| virtual memory deep dive | L2+L3 | done |
| epoll and event loop bridge | L2+L3 | done |
| file system and page cache | L1 | todo |
| lock primitives comparison | L1 | todo |
