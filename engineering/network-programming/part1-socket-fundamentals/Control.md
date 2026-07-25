很好。

我认为这里开始进入 **TCP 设计最容易混淆的一章**。

很多人学 TCP 学了很多年，都分不清：

> **Sliding Window、Flow Control、Congestion Control 到底是什么关系？**

实际上它们是三个不同层次的问题。

```
Sequence + ACK
        │
        ▼
Sliding Window（一种发送机制）
        │
        ├────────► Flow Control（保护接收方）
        │
        └────────► Congestion Control（保护网络）
```

注意：

**Sliding Window 不是 Flow Control。**

它们不是同义词。

---

# Chapter 8 Flow Control（流量控制）

先回答一句话：

> **Flow Control 到底在解决什么？**

答案：

> **防止发送方发送得比接收方处理得更快。**

注意。

不是：

网络。

不是：

路由器。

不是：

交换机。

而是：

Receiver。

---

# 一个现实例子

服务器：

```
100Gbps NIC
```

客户端：

```
手机

4G 网络
```

或者反过来：

客户端：

```
100Gbps
```

服务器：

```
树莓派
```

谁快？

显然：

速度不同。

如果：

发送方：

无限：

发送。

接收方：

Buffer：

迟早：

满。

于是：

Flow Control。

---

# Receive Buffer

TCP 每个连接：

都有：

Receive Buffer。

例如：

```
64KB
```

假设：

开始：

```
Receive Buffer

+----------------------------------+

                                  空

+----------------------------------+
```

客户端：

发送：

```
20KB
```

变成：

```
Receive Buffer

+====================--------------+

20KB

还剩44KB

+----------------------------------+
```

内核：

马上：

回复：

ACK。

同时：

告诉：

客户端：

```
rwnd = 44KB
```

意思：

> **我还能接收 44KB。**

注意。

不是：

已经收到了多少。

而是：

还能收多少。

---

# Window 字段到底是什么？

终于：

对应：

Header。

```
ACK = 20000

Window = 45000
```

Window：

就是：

```
Advertised Window
```

中文：

**通告窗口。**

或者：

Receive Window。

它来自：

Receive Buffer。

例如：

```
Receive Buffer

64KB

已经占20KB

剩44KB
```

于是：

Window：

就是：

```
44KB
```

---

# Window 为什么一直变化？

因为：

应用程序：

一直：

recv()。

假设：

Python：

```python
data = sock.recv(4096)
```

发生什么？

很多人认为：

只是：

Python：

拿数据。

实际上：

发生：

```
Receive Buffer

减少4KB
```

于是：

```
剩48KB
```

下一次：

ACK：

```
Window=48KB
```

所以：

Window：

一直：

动态变化。

---

# 一个很多人不知道的事实

Flow Control

其实：

不是：

TCP 和 TCP。

而是：

```
Application

↓

Kernel Buffer

↓

TCP
```

应用：

处理速度：

决定：

Receive Window。

例如：

你的程序：

```python
while True:

    pass
```

根本：

不：

recv()。

Receive Buffer：

越来越满。

最终：

```
Window=0
```

TCP：

停止：

发送。

所以：

Flow Control

最终保护的是：

**应用程序。**

不是：

Kernel。

---

# Zero Window（零窗口）

终于来了。

假设：

Buffer：

满。

```
Receive Buffer

████████████████████████

100%
```

TCP：

回复：

```
ACK

Window=0
```

什么意思？

> **不要再发了。**

发送方：

立即：

停止。

注意。

不是：

断开。

只是：

暂停。

---

# 一个经典问题

如果：

Window=0。

以后：

应用：

终于：

开始：

recv()。

Buffer：

空了。

发送方：

怎么知道？

这是：

TCP：

一个：

经典设计。

---

# Window Update

接收方：

发现：

Buffer：

空了。

发送：

```
ACK

Window=16384
```

告诉：

发送方：

> **继续发。**

这：

就是：

Window Update。

---

# 又一个问题

如果：

这个：

Window Update：

丢了？

发送方：

永远：

认为：

```
Window=0
```

是不是：

死锁？

是的。

TCP：

当然：

考虑到了。

---

# Persist Timer（坚持定时器）

发送方：

看到：

```
Window=0
```

以后。

不会：

一直：

睡觉。

而是：

启动：

Persist Timer。

过一会。

发送：

一个：

Window Probe。

例如：

```
Seq = 当前序号

Length = 1 Byte
```

或者在现代实现中，发送一个**零窗口探测（Zero Window Probe）**报文，用于迫使对方回复最新窗口信息。

目的：

不是：

发数据。

而是：

问：

```
你的 Window

还是0吗？
```

如果：

接收方：

已经：

恢复。

回复：

```
Window=8000
```

发送：

继续。

---

# 整个 Flow Control

其实：

只有一句话。

```
Receiver

↓

Receive Buffer

↓

Advertised Window

↓

Sender
```

发送方：

永远：

根据：

Receiver：

告诉自己的：

Window：

决定：

还能：

发多少。

---

# 到这里，一个误区终于可以纠正

很多人说：

> Sliding Window 就是 Flow Control。

其实：

不是。

Sliding Window：

回答：

> **如何连续发送数据，提高吞吐量？**

Flow Control：

回答：

> **连续发送时，发送多少才不会压垮接收方？**

所以：

Flow Control

只是：

Sliding Window

的一部分。

---

# 但是还有一个更大的问题

假设：

Receiver：

Buffer：

无限大。

```
Window=10GB
```

是不是：

发送方：

就可以：

一直：

发？

不是。

为什么？

因为：

**网络中间**：

还有：

```
Router

Switch

Queue

Link
```

这些：

也会：

满。

这时候：

不是：

Receiver

处理不了。

而是：

**Internet**

处理不了。

于是：

TCP：

发明了：

> **Congestion Control（拥塞控制）**

它保护的对象不是接收方，而是整个网络。

---

## 下一章：Congestion Control

这一章是 TCP 最复杂，也是现代网络演进最多的部分。

我们会按历史发展来理解，而不是死记算法：

1. 为什么互联网需要拥塞控制？（1986 年互联网拥塞崩溃）
2. `cwnd` 到底是什么？为什么还需要它？
3. Slow Start（慢启动）为什么叫"慢"，实际上却是指数增长？
4. Congestion Avoidance（拥塞避免）为什么变成线性增长？
5. Fast Retransmit（快速重传）和 Fast Recovery（快速恢复）如何避免每次都重新慢启动？
6. 为什么现代 Linux 默认使用 CUBIC，而很多数据中心和 Google 使用 BBR？

理解这一章之后，你就不仅知道 TCP 为什么"可靠"，还会知道它为什么能够在复杂互联网中保持高吞吐量而不把网络压垮。
