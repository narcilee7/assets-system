# libuv

## libuv runtime

```text
为什么 Node.js 需要 libuv？
        │
        ▼
libuv Architecture（整体架构）
        │
        ▼
Event Loop（核心）
        │
        ▼
Watcher / Handle / Request
        │
        ▼
I/O Poll（epoll/kqueue/IOCP）
        │
        ▼
Timer
        │
        ▼
Thread Pool
        │
        ▼
TCP Server 实现
        │
        ▼
DNS 为什么走线程池？
        │
        ▼
File I/O 为什么不用 epoll？
        │
        ▼
Async Queue
        │
        ▼
Cross Platform Design
        │
        ▼
Node.js 如何建立在 libuv 之上
```

## why：为什么需要libuv？它解决了什么问题？

### Thread-Per-Connetion

传统模型，我们为每个网络连接分配一个独立线程

```c
while (1) {
  int cliend_fd = accept(server_fd);
  pthread_create(&thread, NULL, handler_client, &client_fd);
}

void *handle_client(void* fd) {
  char buf[1024];

  int bytes = read(*fd, buf, 1024);
  process(buf);
}
```

内核层面的惩罚：当连接数达到数万（C10K）时，这意味着操作系统要维护数万个线程。
内存硬伤： 每个线程在 Linux 下默认需要 $8\text{ MB}$ 的栈空间（即使调小也需要几百 $\text{KB}$），数万个线程会瞬间吃光物理内存。
上下文切换（Context Switch）雪崩： 内核的调度器（Scheduler）需要不断地保存和恢复 CPU 寄存器状态、刷新 TLB（页表缓存）。当线程过多时，CPU 的大部分算力没有用在执行业务逻辑上，而是浪费在了线程切换上。

### 操作系统方向分裂

1. Linux 的路线：Reactor 模型（基于状态通知）
Linux 经历了 select -> poll -> epoll 的演进。

epoll 的本质： 它是同步非阻塞的。你在 epoll 中注册你关心的 fd。当数据到达网卡，触发硬件中断，Linux 内核将数据复制到内核缓冲区，并将该 fd 放入 epoll 的就绪链表中。

通知时机： epoll_wait 醒来，告诉上层：“数据已经到了内核缓冲区，你可以来读了。” 于是主线程调用 read()，把数据从内核空间复制到用户空间。

2. Windows 的路线：Proactor 模型（基于完成通知）
Windows 走了一条完全不同的路：IOCP（Input/Output Completion Ports）。

IOCP 的本质： 它是真正的异步 I/O（Asynchronous I/O）。

通知时机： 当你发起一个读取请求时，你需要提前准备好一个用户态的缓冲区（Buffer）并递给内核。内核在后台自己静悄悄地把数据从网卡读到内核，再自动复制到你给的缓冲区中。全部搞定后，IOCP 通知你：“头儿，数据已经放到你的变量里了，你直接用吧。”


#### 问题

如果你想写一个跨平台的高性能 Web 服务器（比如 Node.js 这种需要运行在 Windows、Linux 和 macOS 上的运行时），你会发现：

没法用统一的代码架构兼容：

在 Linux 下，你得先等通知，再自己用 read() 去读（Reactor）。

在 Windows 下，你得先丢一个 Buffer 过去投递请求，然后坐等完成通知（Proactor）。

抹平这种架构差异，靠常规的抽象层（如简单的封装宏或条件编译）是绝对做不到的。 
必须有一个库，在底层实现一套复杂的机制：在 Linux 下模拟出 Proactor 的行为，或者在 Windows 下适配 Reactor 的习惯。libuv 最终选择了在上层暴露 Proactor（异步完成）的接口，在 Linux 下用 epoll 模拟实现。

### 坑

既然网络可以非阻塞，文件的`read/write`肯定页可以非阻塞。
在 Linux 中，哪怕你给一个普通文件描述符设置了 O_NONBLOCK 标志：
```c
int fd = open("large_file.data", O_RDONLY | O_NONBLOCK);
read(fd, buf, 1024); // 依旧会阻塞
```

- why: Linux 内核在设计时，认为普通文件总是“可读”的（因为文件指针总是在那，不像网络套接字需要等对端发送）。但问题是，如果该文件的数据此时不在 Page Cache（内存缓存）中，内核就必须发起磁盘 I/O。
- 代价：此时，调用 read 的线程会被迫进入不可中断睡眠状态（D 状态），直到磁盘把数据读进内存。在这个过程中，你的整个事件循环（Event Loop）主线程就会被彻底卡死，无法处理任何网络连接。
(注：Linux 后来推出了 AIO，但早期极其难用且只支持 O_DIRECT 绕过缓存；直到近年的 io_uring 才彻底解决，但那是后话。)


### libux解决了什么

libuv 的出现，不是为了发明新的多路复用技术，而是为了解决以下极其痛苦的工程死结：

1. 统一异步哲学： 将 Linux 的“状态就绪通知（Reactor）”与 Windows 的“操作完成通知（Proactor）”强行统一，对上层暴露出完全一致的异步回调 API。
2. 解决文件阻塞陷阱： 内部建立线程池，专门用来啃磁盘 I/O 这块硬骨头，让主线程可以永远保持非阻塞的“纯净”状态，专注调度网络事件。
3. 提供跨平台的工业级多路复用外壳： 封装了不同平台上由于边缘触发（Edge Triggered）、水平触发（Level Triggered）以及各种诡异的系统 Bug（例如早期的 epoll 假唤醒）。

## Abstraction

libuv 是如何在高度缺乏面向对象特性的 C 语言中，通过结构体继承、多态，以及独特的内存分配哲学，硬生生将 Linux 的 Reactor 和 Windows 的 Proactor 扭合到一起的。

### 矛盾：Reactor和Proactor

为了理解 libuv 的抽象有多精妙，我们必须先看清它要抹平的底层 API 鸿沟有多大。

当我们要从一个 TCP 连接读取数据时，两大阵营的写法截然相反：

- Linux (epoll / Reactor) 的思维：
  1. 告诉 epoll：“我对 fd 的可读状态感兴趣。
  2. ”进入事件循环，epoll_wait 阻塞。
  3. 当内核通知 fd 可读时，主线程亲自调用 read(fd, buf, len)。
  4. 特点： 读操作（read 动作）发生在事件触发之后，且由主线程自己执行。

- Windows (IOCP / Proactor) 的思维：
  1. 分配一个内核重叠结构（OVERLAPPED），并开辟好一块内存 buf。
  2. 提请告知内核：“请帮我把 fd 的数据读到 buf 里。”（通过 ReadFile 发起）。
  3. 进入事件循环，GetQueuedCompletionStatus 阻塞。
  4. 内核通过硬件和 DMA 将数据直接搬到 buf 完毕后，通知主线程。
  5. 特点： 读操作在事件通知之前就已经由内核在后台完成了。

libuv 的选择：全面倒向 Proactor
libuv 在上层 API 的设计上，完全采用了 Windows 的 Proactor 哲学。
也就是说，无论是写 Linux 还是 Windows 代码，上层看到的接口都是：“给你一个回调函数和一个缓冲区，数据读完了/写完了再来叫我。”

为了在 Linux（一个天生是 Reactor 的系统）上玩出 Proactor 的花样，libuv 必须在中间做大量的“偷梁换柱”。这就催生了它的核心抽象。

### 状态与动作的剥离：Handle与Request

libuv 将所有异步行为抽象为两大基类结构体：`uv_handle_t` 和`uv_req_t`。这种“双轨制”设计是它能统一天下模型的关键。

#### Handle(`uv_handle_t`)---长期存在的“状态实体”

Handle代表了一个生命周期较长的资源或状态机：
- 抽象了：OS的FD、SOckets、interval
- 隐藏了：具体的资源句柄，以及资源的关闭、保活逻辑
- 典型：`uv_tcp_t`、`uv_timer_t`、`uv_fs_event_t`

#### Request(`uv_req_t`)---短暂的“动作/操作”

Request 代表一个一次性的、立即可结束的异步操作。它通常依附于某个 Handle 执行。

- 它抽象了： “正在进行中”的 I/O 动作。
- 隐藏了： 极其复杂的、因平台而异的异步状态上下文。
- 典型代表： uv_write_t（一次写数据的动作）、uv_connect_t（一次发起连接的动作）、uv_fs_t（一次文件读写请求）。

##### 为什么必须这样分离

这种分离完美解决了跨平台差异。
在 Linux 下，你对一个 uv_tcp_t (Handle) 发起多次 uv_write_t (Request)。因为 Linux 的 write 可能因为缓冲区满而无法一次性写入，libuv 就会把这些 uv_write_t 挂载到 Handle 内部的队列里。每当 epoll 报告可读写状态时，libuv 的内部循环就去消费这些 Request，直到全部写完，才调用上层的完成回调。

对上层而言： 根本不知道底层经历了多少次 epoll 唤醒和分批 write，只知道“这一次写请求完成了”。

## Architecture And Lifecycle

### 核心骨架：`uv_run`的7大阶段精密编排

很多人知道核心循环有几个阶段，但不知道这些阶段在底层为什么这么排序。我们来看写在 src/unix/core.c（或 Windows 对应文件）中的 uv_run 核心伪代码架构：

```c
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  int r;
  int timeout;

  // r 代表 loop 中是否还有活跃的(active) Handle 或 Request
  r = uv__loop_alive(loop);
  if (!r) uv__update_time(loop);

  while (r != 0 && loop->stop_flag == 0) {
    uv__update_time(loop);            // 1. 更新循环时间
    uv__run_timers(loop);             // 2. 运行定时器
    
    r = uv__run_pending(loop);        // 3. 处理 Pending I/O 回调
    uv__run_idle(loop);               // 4. 运行 Idle 句柄
    uv__run_prepare(loop);            // 5. 运行 Prepare 句柄

    timeout = 0;
    if ((mode == UV_RUN_ONCE && !r) || mode == UV_RUN_DEFAULT) {
      timeout = uv_backend_timeout(loop); // 计算 Poll 阶段最长阻塞多久
    }

    uv__io_poll(loop, timeout);       // 6. 核心：I/O Poll (阻塞轮询)
    
    uv__run_check(loop);              // 7. 运行 Check 句柄
    uv__run_closing_handles(loop);    // 8. 销毁 Close 句柄

    r = uv__loop_alive(loop);
    if (mode == UV_RUN_ONCE) break;
  }
  return r;
}
```

1. uv__update_time 与 uv__run_timers
设计内幕： 每次循环开始，第一件事是调用 uv__update_time()，通过系统调用（Linux 下的 clock_gettime）获取当前的绝对时间，并缓存在 loop->time 中。

为什么要缓存？ 因为系统调用是有开销的。后续所有定时器（Timers）在对比自己是否过期时，直接对比 loop->time 即可，避免了在单次循环中频繁陷入内核获取时间。接着，从最小堆（Min-Heap）中取出所有到期的定时器并执行回调。

2. uv__run_pending
设计内幕： 这里存放的是上一次循环中被延迟执行的 I/O 回调。例如：某次写操作在系统内核报错（比如 ECONNREFUSED），为了保证上层逻辑行为的一致性，libuv 不会立刻在 Poll 中报错，而是把这个错误和回调塞进 pending_queue，留到下一次循环的这个阶段集中消费。

3. uv__run_idle 与 uv__run_prepare
设计内幕： 这两个阶段属于“不占座”的空转阶段。只要有活跃的 idle 或 prepare 句柄，每次循环到这里都会执行。

区别与用意： prepare 阶段紧邻 uv__io_poll（阻塞轮询）。它唯一的战略意义就是：让上层有机会在主线程被系统调用（如 epoll_wait）卡死之前，做最后一次检查或数据准备。

4. uv__io_poll（大本营）
设计内幕： 这是整个事件循环唯一会发生线程阻塞的地方。它会调用底层的系统多路复用 API（epoll_wait / kqueue / GetQueuedCompletionStatus）。

动态计算的 timeout： 决定它在这里卡多久的，是前面步骤算出来的 timeout：

如果 idle 队列不为空，timeout = 0（完全不阻塞，立刻滑过，给空闲任务让路）。

如果有定时器，timeout = 最近一个定时器触发表的时间 - loop->time（卡到定时器快到期时必须醒来）。

如果啥都没有，timeout = -1（无限期死等，直到网卡来数据）。

5. uv__run_check
设计内幕： 紧跟在 uv__io_poll 之后。这就是 Node.js 中 setImmediate() 的底层依据。因为紧跟在 Poll 之后，所以如果 Poll 阶段有网络数据进来触发了回调，紧接着在 check 阶段注册的代码就会以最高优先级被立刻执行。

6. uv__run_closing_handles
设计内幕： 专用于处理调用了 uv_close() 的 Handle。libuv 不允许你直接 free() 一个正在运行的 Handle。你必须调用 uv_close(handle, close_cb)，它会被挂到 closing_handles 队列，在单次循环的最后阶段集中释放内存并触发 close_cb。这保证了在前面所有阶段中，指针的安全和有效性。

#### 线程池架构嵌入：不对称的单线程与多线程协作
我们在第一节（Why）中提到，文件 I/O 无法非阻塞。为了保持事件循环的单线程纯净性，libuv 实现了一个内部线程池：线程池内部全面负责阻塞，主线程只负责消费结果。

这个架构在底层是通过一个叫 uv__work 的机制实现的（内部统称为 threadpool.c）。

 【主事件循环线程 (Main Loop)】                【线程池 (Thread Pool)】
 ─────────────────────────────               ───────────────────────
   uv_fs_read(请求文件)
        │
        ▼ (封装为 uv__work 结构体)
   [ 提交到线程池全局队列 ] ──(加锁/条件变量)──►   [ 线程池工作队列 ]
        │                                           │ 
   继续欢快地运行事件循环                            ├─► 子线程1: 阻塞读磁盘(Read)
   (处理网络epoll, 绝不卡顿)                          ├─► 子线程2: 阻塞做DNS解析
        │                                           │ (完成任务)
        │                                           ▼
   [ uv__io_poll() 阻塞等待 ] ◄───(往管道写1字节)─── [ 往主线程的Loop发信号 ]
        │
        ▼ (醒来发现管道可读)
   [ 执行 uv_fs_read 的完成回调 ]
跨线程桥梁：Pipe（管道）与 Eventfd
当线程池中的某个子线程完成了耗时、阻塞的文件读取后，数据已经拿到了用户态内存中。但子线程绝对不允许直接调用用户的业务回调函数。 因为用户的回调函数不是线程安全的，必须回到主线程执行。

那么，子线程如何通知主线程？

Linux 下的精妙设计：
在事件循环初始化时（uv_loop_init），libuv 会在主线程的 epoll 里注册一个特殊的 fd —— 管道（Pipe）或者 eventfd。

通知链路：

子线程搞定任务，将请求移入 loop->wq（完成队列）。

子线程向这个 eventfd 里写入 1 个字节（发送信号）。

主线程当时正卡在 uv__io_poll 的 epoll_wait 上。由于 eventfd 变为了可读状态，内核瞬间唤醒主线程。

主线程醒来，读取该 eventfd（清空信号），然后遍历 loop->wq 队列，安全地在单线程环境中执行文件读取完成后的回调函数。

#### 架构设计的深刻考量
这种双引擎（单线程网卡多路复用 + 多线程文件/重度计算池）的架构设计，带来了以下极具深意的工程结果：

最大化降低锁竞争： 整个主循环在跑 Timers、Pending、Idle、Prepare、Check、Close 时，完全不需要加锁。只有在子线程往完成队列 loop->wq 里塞结果、以及主线程去消费它时，才会有一次极短暂的互斥锁（Mutex）争抢。

避免了线程上下文切换开销： 网络的吞吐量可能极高（每秒数万请求），如果这些请求分布在多线程中，CPU 就会废掉。而 libuv 让这数万请求全在主线程按部就班地靠 epoll 驱动；只有极少数（比如几十个）文件读写或密码加密（uv_queue_work）才会去线程池。

这就是 libuv 的架构艺术。理解了它在单线程与多线程之间的优雅划分，接下来，我们就要精确分析支撑这套架构的最底层核心数据结构（Data Structure）—— 看一看那两个甚至不需要分配内存的链表和堆，究竟长什么样。
