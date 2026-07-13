# Chapter 2：Blocking、Non-Blocking、Synchronous、Asynchronous

我先说一个结论。

> **Blocking / Non-Blocking 和 Synchronous / Asynchronous 是两个完全不同的维度。**

这是几乎所有初学者都会混淆的地方。

很多文章甚至会画成：

```
Blocking IO
NonBlocking IO
Async IO
```

然后让你觉得它们是并列关系。

其实不是。

---

## 我们先把两个维度拆开

第一个维度：

> **Blocking vs Non-Blocking**

回答的问题是：

> **调用线程要不要等待？**

第二个维度：

> **Synchronous vs Asynchronous**

回答的问题是：

> **I/O 完成以后，谁负责通知调用者？**

注意。

回答的问题都不一样。

---

# 第一维：Blocking / Non-Blocking

来看一段代码。

```python
data = sock.recv(1024)
```

假设：

数据还没到。

Blocking：

Kernel：

```
Thread

↓

Sleep
```

直到：

数据来了。

才：

返回。

整个期间：

线程：

什么都不能干。

---

NonBlocking：

同样：

```python
sock.recv()
```

Kernel：

立刻：

返回：

```
EAGAIN
```

告诉你：

```
现在没有。
```

线程：

继续：

执行：

其它代码。

所以：

Blocking：

讨论的是：

> **这个调用会不会让当前线程停下来。**

---

# 第二维：Synchronous / Asynchronous

这个更容易误解。

还是：

```python
recv()
```

真正发生：

其实有：

两个阶段。

```
① 数据到达 Kernel Buffer

② Kernel Buffer

↓

复制

↓

User Buffer
```

注意：

这是两件事。

---

同步：

意味着：

> **调用者自己负责等待整个过程结束，并主动取得结果。**

例如：

```python
data = recv()
```

返回：

的时候。

数据：

已经：

在：

User Buffer。

整个过程：

调用者：

一直：

参与。

---

异步：

完全不同。

例如：

```python
recv_async(callback)
```

立即：

返回。

CPU：

继续：

工作。

什么时候：

数据：

到了。

Kernel：

或者 Runtime：

通知：

```
callback(data)
```

调用者：

不用：

自己：

等待。

---

所以：

同步回答的是：

> **谁来"收尾"这次 I/O？**

同步：

调用者自己。

异步：

内核/运行时完成后主动通知。

---

# 一个生活中的例子

去餐厅。

Blocking：

```
点餐

↓

站在窗口

↓

一直等

↓

拿到饭
```

什么也干不了。

---

NonBlocking：

```
点餐

↓

窗口问：

好了没？

↓

没有

↓

过五秒再问

↓

好了没？

↓

没有

↓

继续问
```

你没堵在窗口。

但是：

一直：

主动：

询问。

---

Async：

```
点餐

↓

给你号码牌

↓

去聊天

↓

广播：

38号取餐
```

你不用：

一直：

问。

别人：

通知你。

---

这个例子非常重要。

你会发现：

**Non-Blocking 和 Async 完全不是一回事。**

---

# 再看 Linux Socket

Blocking：

```python
recv()
```

↓

睡觉。

---

NonBlocking：

```python
recv()
```

↓

EAGAIN。

---

select：

很多人开始混了。

例如：

```python
select()

↓

recv()
```

其实：

recv：

还是：

同步。

为什么？

因为：

select：

只是：

告诉你：

```
可以读了。
```

真正：

复制：

Kernel Buffer

↓

User Buffer。

还是：

```python
recv()
```

完成。

所以：

IO Multiplexing：

属于：

**Synchronous IO。**

这一点在面试中非常高频。

---

# 那 epoll 呢？

也是。

很多人：

认为：

epoll：

异步。

其实：

不是。

epoll：

只是：

```
事件通知
```

真正：

数据：

还是：

```python
recv()
```

拿。

所以：

epoll：

依然：

同步。

---

# 那什么是真正的 Async IO？

Linux：

有：

```text
aio

io_uring（现代）

Windows IOCP
```

例如：

```
read_async(fd)
```

立即：

返回。

内核：

自己：

完成：

```
DMA

↓

Kernel Buffer

↓

User Buffer
```

全部结束。

最后：

通知：

```
Done.
```

调用者：

完全：

没有：

再调用：

```python
recv()
```

去取数据。

这才叫：

Async。

---

# 四种组合

现在终于可以画二维坐标。

```
                    Synchronous           Asynchronous

Blocking        recv()                （几乎没有意义）

NonBlocking     recv()+EAGAIN         io_uring / IOCP
                select
                poll
                epoll
```

这里我补充一个更严谨的说明。

严格来说，这张表是在讨论**网络 Socket I/O**。

对于 Socket：

|                       | 同步（Synchronous）                         | 异步（Asynchronous）                |
| --------------------- | --------------------------------------- | ------------------------------- |
| **阻塞（Blocking）**      | `recv()`（经典 Blocking I/O）               | 很少见，不是主流 Socket 模型              |
| **非阻塞（Non-Blocking）** | `recv()+EAGAIN`、`select`、`poll`、`epoll` | `io_uring`（部分模式）、Windows IOCP 等 |

为什么 `epoll` 还是同步？

因为：

`epoll_wait()` 告诉你：

> **fd 可以读了。**

但是：

真正的数据：

还是：

你自己：

```python
recv(fd)
```

拿回来。

整个 I/O 的完成（尤其是数据拷贝到用户缓冲区）仍然是在你的调用过程中完成的。

---

# 为什么 Node.js 看起来像 Async？

这是很多人最大的疑问。

Node：

```javascript
socket.on("data", ...)
```

看起来：

完全：

Callback。

是不是：

Async IO？

实际上：

不是。

Node：

底层：

```
libuv

↓

epoll

↓

recv()
```

本质：

仍然：

同步。

只是：

libuv：

帮你：

管理：

Event Loop。

于是：

JavaScript：

感觉：

像：

Async。

这也是为什么我们后面要单独学习 Event Loop——**异步编程模型**和**异步 I/O 模型**不是同一个概念。

---

# 现在，我们已经建立了第一张地图

整个 I/O 模型，其实可以按问题来理解：

```
数据没到怎么办？
        │
        ▼
Blocking：线程睡觉
Non-Blocking：立即返回
        │
        ▼
如果立即返回，
什么时候知道数据到了？
        │
        ▼
select / poll / epoll
        │
        ▼
数据到了以后，
谁把数据真正拿出来？
        │
        ▼
自己 recv() → 同步 I/O
内核完成并通知 → 异步 I/O
```

这张图是后面所有内容的基础。

---
