# 为什么 Node.js 要用 epoll/kqueue 替代 select


Node.js 的单线程异步 I/O 全靠 libuv 这个 C 语言库。libuv 在内部实现了一个经典的事件循环（Event Loop）。

在事件循环的每一步中，都有一个至关重要的阶段叫做 Poll for I/O（I/O 轮询阶段）。在这个阶段，libuv 会根据当前运行的操作系统，选择最合适的 I/O 多路复用系统调用：

在 Linux 上，它会使用 epoll。

在 macOS/BSD 上，它会使用 kqueue。

在 Windows 上，它会使用 IOCP（异步 I/O）。

只有在极少数古老的、不支持高并发特性的系统上，它才会降级使用 select 或 poll。


```c
// 这是一个高度简化的 libuv 在执行事件循环时的伪代码
void uv__io_poll(uv_loop_t* loop, int timeout) {
    fd_set read_fds;
    FD_ZERO(&read_fds);
    int max_fd = 0;

    // 1. 遍历由 Node.js 应用层注册进来的所有需要监听的 I/O 观察者（Watcher）
    QUEUE* q;
    QUEUE_FOREACH(q, &loop->watcher_queue) {
        uv__io_t* w = QUEUE_DATA(q, uv__io_t, watcher_queue);
        // 把这些 Socket 的文件描述符（FD）加到内核的 fd_set 集合里
        FD_SET(w->fd, &read_fds);
        if (w->fd > max_fd) max_fd = w->fd;
    }

    // 2. 真正的系统调用：线程在此处挂起阻塞，等待内核通知哪些 FD 有数据
    // timeout 是根据 Node.js 里的 setTimeout 动态计算出来的
    int ready_count = select(max_fd + 1, &read_fds, NULL, NULL, timeout);

    if (ready_count > 0) {
        // 3. O(n) 轮询：select 返回后，必须遍历所有注册的 FD，找出到底是哪几个就绪了
        QUEUE_FOREACH(q, &loop->watcher_queue) {
            uv__io_t* w = QUEUE_DATA(q, uv__io_t, watcher_queue);
            
            if (FD_ISSET(w->fd, &read_fds)) {
                // 4. 找到了就绪的 FD！将其对应的回调函数塞入 pending 队列
                w->cb(loop, w, POLLIN); 
            }
        }
    }
}
```

### 既然可以用 select 实现，为什么 Node.js 还要费尽心机在 Linux 上用 epoll，在 macOS 上用 kqueue？

你可以从 Node.js 单线程架构 的痛点去切入：

select 的上限太低： select 默认受内核 FD_SETSIZE 限制，最多只能监听 1024 个 FD。这意味着如果真正用 select，你的 Node.js 服务器最多只能同时处理 1024 个并发连接，这直接废掉了 Node.js “高并发”的底牌。

select 的 O(n) 拷贝与遍历是单线程的死敌： select 每次调用都要把所有 FD 集合在用户态和内核态之间来回拷贝，且返回后还要盲目遍历。如果有 1000 个连接，只有一个连接活跃，select 也要把 1000 个连接盘一遍。对 Node.js 这种单线程应用来说，这种无效的 CPU 空转会直接导致事件循环卡顿，增加请求延迟。而 epoll 的 O(1) 特性完美契合了单线程高效分发事件的需求。
