# I/O Models and epoll

## 目标

理解 Unix 五种 I/O 模型、epoll 的实现原理，以及它们如何支撑高并发事件驱动架构。

## 场景

- 为什么 select/poll 撑不过 10K 连接？
- epoll 为什么能做到 O(1) 监听海量 fd？
- 边缘触发（ET）和水平触发（LT）有什么区别？
- 为什么 Redis 单线程能处理 10K QPS？
- Node.js 的 event loop 和 epoll 是什么关系？

## Unix 五种 I/O 模型

### 1. 阻塞 I/O（Blocking I/O）

```
进程调用 recvfrom() → 内核准备数据 → 数据拷贝到用户态 → 返回

         应用进程              内核
           |                    |
           |---- recvfrom() --->|
           |                    | 等待数据
           |                    | （阻塞）
           |                    | 拷贝数据
           |<--- 返回数据 ------|
           |

特点：简单，一个连接一个线程/进程
缺点：连接数多时线程爆炸，上下文切换开销大
代表：传统 Java BIO、PHP Apache prefork
```

### 2. 非阻塞 I/O（Non-blocking I/O）

```
进程调用 recvfrom() → 无数据立即返回 EAGAIN → 轮询直到有数据

         应用进程              内核
           |                    |
           |---- recvfrom() --->|
           |<--- EWOULDBLOCK --|
           |     （轮询）        |
           |---- recvfrom() --->|
           |<--- EWOULDBLOCK --|
           |         ...        |
           |---- recvfrom() --->|
           |<--- 返回数据 ------|

特点：不会阻塞，但轮询浪费 CPU
代表：早期 NIO 实现、setsockopt(O_NONBLOCK)
```

### 3. I/O 多路复用（I/O Multiplexing）

```
一个线程同时监听多个 fd，只有就绪的 fd 才进行 I/O

         应用进程              内核
           |                    |
           |---- select/poll --->|
           |                    | 监听多个 fd
           |                    | （阻塞等待任意 fd 就绪）
           |<--- 返回就绪 fd ---|
           |---- recvfrom() --->| 对就绪 fd 操作
           |<--- 返回数据 ------|

实现：select、poll、epoll、kqueue、IOCP
代表：Nginx、Redis、Node.js、Netty
```

### 4. 信号驱动 I/O（Signal-driven I/O）

```
注册 SIGIO 信号 → 内核数据就绪时发信号 → 应用调用 recvfrom

特点：不需要轮询，但信号处理复杂
代表：极少使用，SIGIO 在 Linux 中并不成熟
```

### 5. 异步 I/O（Asynchronous I/O）

```
调用 aio_read() → 立即返回 → 内核完成 I/O 后通知应用

         应用进程              内核
           |                    |
           |---- aio_read() --->|
           |<--- 立即返回 ------|
           |    （继续做其他事）  |
           |                    | 等待数据
           |                    | 拷贝到用户缓冲区
           |<--- 信号/回调通知--|

特点：真正的异步，全程不阻塞
代表：Windows IOCP、Linux io_uring、Java AIO
注意：Linux 传统 AIO（libaio）只对文件有效，网络不行
```

## 对比表

| 模型 | 等待数据 | 拷贝数据 | 阻塞点 | 适用场景 |
|---|---|---|---|---|
| 阻塞 I/O | 阻塞 | 阻塞 | 全程 | 低并发 |
| 非阻塞 I/O | 轮询 | 阻塞 | 拷贝 | 极少单独使用 |
| I/O 多路复用 | 阻塞（在 select 上） | 阻塞 | 拷贝 | 高并发网络 |
| 信号驱动 | 不阻塞 | 阻塞 | 拷贝 | 极少 |
| 异步 I/O | 不阻塞 | 不阻塞 | 无 | 高并发 + 高吞吐 |

## select / poll 的瓶颈

### select

```c
int select(int nfds, fd_set *readfds, fd_set *writefds,
           fd_set *exceptfds, struct timeval *timeout);

限制：
  1. fd 数量限制：FD_SETSIZE = 1024
  2. 每次调用都要拷贝 fd_set 到内核
  3. 内核遍历所有 fd 检查就绪状态：O(n)
  4. 返回后用户态要遍历所有 fd 找到就绪的
```

### poll

```c
int poll(struct pollfd *fds, nfds_t nfds, int timeout);

struct pollfd {
    int   fd;      // 文件描述符
    short events;  // 监听的事件
    short revents; // 返回的就绪事件
};

改进：
  - 无 1024 限制（受限于进程 fd 上限）
  
未改进：
  - 每次调用拷贝整个数组到内核
  - 内核遍历所有 fd：O(n)
  - 返回后用户态遍历：O(n)
```

### 为什么撑不过 10K？

```
假设 10,000 连接，每次只有 100 个活跃：
  - select/poll 每次都要拷贝 10K fd 到内核
  - 内核遍历 10K 检查就绪
  - 用户态遍历 10K 找到就绪的
  
时间复杂度：O(n)，n = 总连接数
随着连接数增长，线性开销拖垮系统
```

## epoll 原理

### 三个核心系统调用

```c
// 1. 创建 epoll 实例
int epoll_create1(int flags);

// 2. 注册/修改/删除 fd
int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event);
// op: EPOLL_CTL_ADD / EPOLL_CTL_MOD / EPOLL_CTL_DEL

// 3. 等待事件（阻塞）
int epoll_wait(int epfd, struct epoll_event *events,
               int maxevents, int timeout);
```

### 数据结构

```
epoll 核心结构：

  epoll instance
    ├── rb_root rbr        // 红黑树：存储所有注册的 fd
    ├── struct list_head rdllist  // 就绪链表：就绪的 fd 在这里
    └── wait_queue_head_t wq      // 等待队列：epoll_wait 阻塞在这里

每个被监听的 fd：
  struct epitem
    ├── rb_node            // 红黑树节点
    ├── struct list_head rdllink  // 就绪链表节点
    ├── struct epoll_filefd ffd   // fd + file 指针
    └── struct list_head fllink   // 链接到 file 的 epoll 列表
```

### 为什么 epoll 是 O(1)？

```
注册阶段（epoll_ctl ADD）：
  - 把 fd 插入红黑树：O(log n)
  - 只在注册时做一次

事件就绪阶段（内核收到 I/O）：
  - 网卡中断 → 协议栈处理 → socket 就绪
  - 调用 fd 的回调函数 ep_poll_callback
  - 把 epitem 加入 rdllist 就绪链表：O(1)
  - 唤醒 epoll_wait 的等待队列

等待阶段（epoll_wait）：
  - 直接从 rdllist 取就绪事件：O(活跃事件数)
  - 不需要遍历所有 fd

总结：
  - select/poll：O(总 fd 数)，每次都要遍历
  - epoll：O(活跃事件数)，只处理就绪的
```

### LT（Level Trigger）vs ET（Edge Trigger）

```
水平触发 LT（默认）：
  - 只要 fd 还有数据可读，epoll_wait 就会一直返回
  - 优点：编程简单，不用担心漏读
  - 缺点：可能重复触发，效率略低

边缘触发 ET：
  - fd 状态变化时（不可读→可读）只触发一次
  - 必须一次性读完（循环 read 到 EAGAIN）
  - 优点：减少 epoll_wait 返回次数，效率更高
  - 缺点：编程复杂，必须非阻塞 + 循环读

ET 模式示例：
  fd 收到 2KB 数据：
    - LT：read 1KB → epoll_wait 再次返回 → read 剩余 1KB
    - ET：read 1KB → 不触发 → 必须循环读到 EAGAIN
```

### epoll ET 的正确写法

```c
// 必须设置非阻塞
int flags = fcntl(fd, F_GETFL, 0);
fcntl(fd, F_SETFL, flags | O_NONBLOCK);

// ET 模式注册
struct epoll_event ev;
ev.events = EPOLLIN | EPOLLET;
ev.data.fd = fd;
epoll_ctl(epfd, EPOLL_CTL_ADD, fd, &ev);

// 读事件处理：必须循环读到 EAGAIN
while (true) {
    ssize_t n = read(fd, buf, sizeof(buf));
    if (n > 0) {
        process_data(buf, n);
    } else if (n == -1 && errno == EAGAIN) {
        break;  // 读完了
    } else if (n == 0) {
        close(fd);  // 对端关闭
        break;
    } else {
        handle_error();  // 其他错误
        break;
    }
}
```

## Event Loop 架构

### Reactor 模式

```
单线程 Reactor：
  ┌─────────────┐
  │  epoll_wait │ ◄── 事件分发中心
  └──────┬──────┘
         │
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
  accept   read    write   timeout
    │        │        │        │
    ▼        ▼        ▼        ▼
  新连接   业务处理  发送响应  定时任务
  注册fd   注册write            

代表：Redis、Nginx（多进程 Reactor）、Netty
```

### 多线程 Reactor

```
主从 Reactor（One EventLoop Per Thread）：

  Main Reactor          Sub Reactor 1      Sub Reactor N
  ┌──────────┐         ┌──────────┐       ┌──────────┐
  │epoll_wait│         │epoll_wait│       │epoll_wait│
  └────┬─────┘         └────┬─────┘       └────┬─────┘
       │                    │                  │
    accept ──────────────►  read/write     read/write
    分发新连接              业务处理（可能   业务处理
                           丢给线程池）

代表：Nginx（多进程）、Netty（主从 EventLoopGroup）
```

### 为什么 Redis 单线程能抗 10K QPS？

```
1. 纯内存操作：O(1) / O(log n)，计算极快
2. I/O 多路复用：单线程 epoll 管理 10K 连接
3. 无锁：单线程不需要锁竞争
4. 避免上下文切换：没有线程切换开销
5. 瓶颈在网络带宽和内存带宽，不在 CPU

注意：Redis 6.0 引入多线程 I/O，但命令执行仍单线程
```

## io_uring（Linux 5.1+）

### 设计

```
目标：真正统一的异步 I/O（网络 + 文件）

核心：两个无锁环形队列（共享内存）
  - Submission Queue (SQ)：应用提交 I/O 请求
  - Completion Queue (CQ)：内核返回 I/O 结果

优势：
  - 无需系统调用提交请求（batch 后统一 syscall）
  - 支持 polling 模式（内核轮询，零中断）
  - 文件 I/O 也是真正的异步
```

### 对比

| 特性 | select/poll | epoll | io_uring |
|---|---|---|---|
| 最大 fd | 1024 / 无限制 | 无限制 | 无限制 |
| 时间复杂度 | O(n) | O(活跃) | O(1) |
| 拷贝开销 | 每次拷贝 fd 数组 | 只注册一次 | 共享内存零拷贝 |
| 文件异步 | 否 | 否 | 是 |
| 系统调用次数 | 每次 I/O | 每次 I/O | batch 批量 |
| 零拷贝 sendfile | 不支持 | 支持 | 支持 |

## 核心追问

1. **epoll 的 fd 就绪后，如果本次没处理完，LT 和 ET 分别会怎样？** LT 下次 epoll_wait 继续返回；ET 不再返回，必须等下次新数据到达
2. **为什么 ET 模式必须配合非阻塞 fd？** 阻塞 fd 在 ET 下可能读到一半阻塞，导致整个 event loop 挂起
3. **epoll 相比 select，优势的本质是什么？** select 每次都要把 fd 集合传给内核并全量遍历；epoll 通过回调机制让内核主动通知，只处理就绪事件
4. **Redis 什么时候会成为瓶颈？** 大 Key 操作、复杂聚合命令、持久化 AOF 刷盘阻塞
5. **io_uring 为什么比 epoll 更快？** 共享内存减少 syscall，支持 batch，真正的异步文件 I/O

## 状态

| 资产 | 状态 |
|---|---|
| process vs thread notes | done |
| virtual memory deep dive | done |
| epoll and event loop bridge | done |
| file system and page cache | todo |
| lock primitives comparison | todo |
