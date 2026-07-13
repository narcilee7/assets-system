# Select 第一个I/O多路复用模型

## 设想一个场景

假设要实现一个聊天服务器，同时维护10000个TCP连接。

最朴素的办法：

```javascript
while (true) {
  recv(conn1);
  recv(conn2);
}
```

有两个问题：
1. Blocking Socket：如果第一个recv(conn1)没有数据，Thread Sleep，后面9999个Thread永远没有机会检查
2. Non-Blocking Socket：把所有socket设置成`O_NONBLOCK`后
   ```C
   while (true) {
      for (...) {
        recv(fd);
      }
   }
   ```

没有数据时 recv() 返回 EAGAIN，虽然线程不会阻塞，但 CPU 会一直循环扫描 10,000 个 fd，这就是 Busy Polling（忙轮询）。

所以真正的问题不是 Blocking，而是：

**如何知道哪些 Socket 已经 Ready，而不是自己一个一个去问？**

## select的设计思想

Linux（准确说最早来自 BSD）没有改变 Socket API，而是增加了一个新的系统调用：

```c
select(...)
```

它不负责读数据，它只负责回答一个问题：

哪些 fd 已经就绪（Ready）？

例如：

```text
fd1  没数据
fd2  有数据
fd3  没数据
fd4  有数据
```

select() 返回：

```
fd2
fd4
```

然后程序再执行：

```c
recv(fd2);
recv(fd4);
```

顺序：
1. `select()`负责发现Ready
2. `recv()`负责真正读数据

因此`select`不是I/O，它只是I/O的调度器。

## 怎么理解`Ready`?

Ready的意思是：如果你现在调用`recv()`，不会阻塞。

例如：
```text
NIC
    ↓
DMA
    ↓
Kernel Socket Buffer
```

数据已经进入 Kernel Buffer。

这时 fd 就变成 Readable。

但是：

```text
Kernel Buffer
      ↓ recv()
User Buffer
```

这一步还没有发生。

所以 select 只是告诉你：

可以读了。

它不会帮你读。

## select的工作流程

```text
Application
      │
      ▼
select(fd_set)
      │
      ▼
Kernel 检查所有 fd
      │
      ▼
哪些 Ready？
      │
      ▼
返回 Ready fd
      │
      ▼
recv(fd)
      │
      ▼
Kernel Buffer → User Buffer
```

select属于`Synchronous I/O`

因为真正的数据复制是在`recv()`里完成的。

## select为什么叫I/O Multiplexing?

Multiflexing的意思是：“一个线程管理多个I/O”

而不是一个“一个线程一个Socket”

```text
           Thread
              │
    ┌─────────┼─────────┐
    │         │         │
  fd1       fd2       fd3
    │         │         │
  Socket    Socket    Socket
```

**因此，一个线程就可以维护成千上万个连接，而不是一个连接对应一个线程。**

## select的内部实现

pass

## 面试高频问题

Q：为什么 select 比非阻塞轮询快？

因为应用程序不用反复对每个 Socket 调用 recv()，而是让内核统一检查所有 fd，一次返回 Ready 集合，减少了大量系统调用和无意义的用户态轮询。

Q：select 为什么还是 O(n)？

因为内核每次都需要遍历整个 fd_set 检查每个 fd 是否 Ready，而不是直接知道哪些 fd 已经发生事件。

Q：select 是异步 I/O 吗？

不是。select() 只负责等待事件，真正的数据读取仍然由应用调用 recv() 完成，因此属于 同步 I/O 多路复用。

## 引发的问题

既然每次都扫描所有 fd 是瓶颈，那内核为什么不能在 Socket 就绪的那一刻，就把它放进一个 Ready 队列，应用直接取 Ready 队列即可？
