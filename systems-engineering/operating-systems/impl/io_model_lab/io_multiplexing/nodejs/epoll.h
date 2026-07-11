// // 这是一个高度简化的 libuv 在执行事件循环时的伪代码
// void uv__io_poll(uv_loop_t* loop, int timeout) {
//     fd_set read_fds;
//     FD_ZERO(&read_fds);
//     int max_fd = 0;

//     // 1. 遍历由 Node.js 应用层注册进来的所有需要监听的 I/O 观察者（Watcher）
//     QUEUE* q;
//     QUEUE_FOREACH(q, &loop->watcher_queue) {
//         uv__io_t* w = QUEUE_DATA(q, uv__io_t, watcher_queue);
//         // 把这些 Socket 的文件描述符（FD）加到内核的 fd_set 集合里
//         FD_SET(w->fd, &read_fds);
//         if (w->fd > max_fd) max_fd = w->fd;
//     }

//     // 2. 真正的系统调用：线程在此处挂起阻塞，等待内核通知哪些 FD 有数据
//     // timeout 是根据 Node.js 里的 setTimeout 动态计算出来的
//     int ready_count = select(max_fd + 1, &read_fds, NULL, NULL, timeout);

//     if (ready_count > 0) {
//         // 3. O(n) 轮询：select 返回后，必须遍历所有注册的 FD，找出到底是哪几个就绪了
//         QUEUE_FOREACH(q, &loop->watcher_queue) {
//             uv__io_t* w = QUEUE_DATA(q, uv__io_t, watcher_queue);

//             if (FD_ISSET(w->fd, &read_fds)) {
//                 // 4. 找到了就绪的 FD！将其对应的回调函数塞入 pending 队列
//                 w->cb(loop, w, POLLIN);
//             }
//         }
//     }
// }
