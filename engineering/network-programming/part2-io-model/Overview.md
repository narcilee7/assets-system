# I/O Model Overview

## 什么是IO

对于OS来说，IO到底是什么？

CPU擅长什么？

```
CPU -> 计算
```

内存：
Memory -> 几十纳秒

网络：
Network

磁盘：

SSD -> 几十微妙、机械盘 -> 几毫秒

**CPU和IO存在巨大的速度差**

I/O Model回答的问题就是：数据还没准备好，CPU应该怎么办？

## 为什么会有IO Model？

因为CPU太快，设备太慢，如果CPU每次都 `recv()`等待。。。CPU资源就会被浪费。

OS要做：如何不让CPU因等待I/O而空转，优化CPU利用率是所有的I/O Model存在的根本原因。

## 什么叫Blocking?

`recv()`会阻塞。

Blocking的对象是谁？当前执行线程Thread。

```python
data = sock.recv(1024)
print("hello")
```

如果没有数据，这个Thread就会Sleep，CPU调度别人这个线程就不能继续执行，这就是Block。

**Block真正的是Thread**

## 什么是叫Non—Blocking？

如果Socket设置`O_NONBLOCK`再`recv()`没有数据。
Kernel不会睡吗直接返回：`EAGAIN`告诉程序“现在没有数据”

Thread继续运行，CPU没有等待。

## Busy Polling(忙轮询)

Blocking ｜ NonBlocking不一定都是坏的。
什么时候再去调用 recv()？才是关键的问题

## 问题

10000个socket

#### Blocking:
```Python`
for sock in sockets:
  sock.recv()
``

第一个没数据。线程：睡了。

后面：9999 个：永远：看不到。

#### NonBlocking

```Python
while True:
  for sock in sockets:
      sock.recv()
```

可以。

但是：

CPU：

100%。

于是：

整个 Linux 社区开始思考一个问题：

有没有一种机制，可以让内核告诉我："哪些 Socket 已经准备好了"，而不是让我一个一个去问？

这就是：

```
select()
poll()
epoll()
```

诞生的原因。