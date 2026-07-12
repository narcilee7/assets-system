# 很好。

如果说前面的内容是在学习 TCP，那么这一章开始，我们学习的是：

> **互联网为什么没有崩溃。**

这不是一句玩笑。

**TCP 拥塞控制（Congestion Control）**就是互联网能够扩展到今天的核心原因之一。

---

# Chapter 9 Congestion Control（拥塞控制）

先问一个问题。

---

## Flow Control 已经存在了。

为什么还需要 Congestion Control？

假设：

Receiver：

```
Receive Buffer = 1GB
```

于是：

```
Window = 1GB
```

发送方：

疯狂发送。

是不是没问题？

不是。

为什么？

因为：

中间还有：

```
Sender

↓

Router A

↓

Router B

↓

Switch

↓

Receiver
```

真正爆掉的：

不是：

Receiver。

而是：

Router。

---

# Router 到底在干什么？

很多人觉得：

Router：

就是：

转发。

实际上：

不是。

Router：

里面：

也有：

Buffer。

例如：

```
Packet

↓

Router Queue

↓

发送
```

如果：

进入：

10000 Packet。

出去：

100 Packet。

剩下：

去哪？

排队。

于是：

```
Router Queue

██████████████
```

越来越满。

最后：

```
Drop Packet
```

开始：

丢包。

---

# TCP 会怎么理解丢包？

TCP：

不知道：

Router。

TCP：

只知道：

```
Packet

没有ACK
```

于是：

认为：

> **网络坏了。**

开始：

重传。

---

# 一个灾难开始了

Router：

已经：

很忙。

TCP：

看到：

丢包。

开始：

```
重传
```

Router：

更忙。

继续：

丢。

TCP：

继续：

重传。

越来越：

堵。

最终：

整个：

Internet：

瘫痪。

---

## 这不是假设。

1986 年。

美国 NSFNET。

真的：

发生过。

名字：

> **Congestion Collapse（拥塞崩溃）**

网络：

带宽：

还有。

但是：

全部：

浪费在：

重传。

真正：

业务：

几乎：

没有。

后来：

Jacobson

提出：

TCP Congestion Control。

互联网：

才：

恢复。

这也是为什么 Jacobson 被认为是 TCP 拥塞控制的奠基人之一。

---

# TCP 终于意识到

TCP：

需要：

一个：

新的窗口。

不是：

Receiver。

而是：

Network。

于是：

```
Congestion Window

cwnd
```

出现。

---

# 现在 TCP 有两个窗口

很多工程师：

第一次：

真正：

理解：

就是：

这里。

```
rwnd

Receiver Window
```

保护：

Receiver。

```
cwnd

Congestion Window
```

保护：

Internet。

真正：

发送：

窗口：

```
min(rwnd,cwnd)
```

终于：

知道：

为什么：

这个公式：

存在。

---

# 一个例子

假设：

```
rwnd = 1MB
```

但是：

```
cwnd = 16KB
```

真正：

发送：

只能：

```
16KB
```

为什么？

网络：

不允许。

---

反过来：

```
rwnd = 8KB

cwnd = 1MB
```

真正：

发送：

```
8KB
```

因为：

Receiver：

慢。

所以：

两个：

窗口：

互相：

限制。

---

# cwnd 怎么知道网络情况？

终于：

来到：

最经典的问题。

TCP：

看不见：

Router。

看不见：

交换机。

看不见：

Queue。

它：

只有：

ACK。

于是：

TCP：

只能：

猜。

这就是：

拥塞控制：

本质。

> **根据 ACK 和丢包，推测网络是否拥塞。**

不是：

测量。

而是：

估计（Estimate）。

---

# 第一代算法：Slow Start

很多人：

看到：

名字：

就误解。

以为：

慢。

其实：

一点：

都不慢。

例如：

开始：

```
cwnd = 1 MSS
```

MSS：

后面：

讲。

先理解：

一包。

发送：

```
1
```

ACK：

回来。

变：

```
2
```

再：

ACK。

变：

```
4
```

继续：

```
8

16

32

64
```

发现了吗？

这是：

```
指数增长
```

一点：

都不慢。

---

# 为什么叫 Slow Start？

因为：

相对于：

```
无限发送
```

它：

已经：

很慢。

历史背景是早期 TCP 在连接建立后会比较保守地探测网络容量，因此命名为 Slow Start。

---

# 为什么指数增长？

因为：

TCP：

不知道：

网络：

到底：

有多大。

例如：

网络：

可以：

100MB/s。

如果：

线性：

```
1

2

3

4

5
```

需要：

很久。

指数：

```
1

2

4

8

16

32
```

很快：

找到：

网络：

容量。

---

# 什么时候停止？

TCP：

有：

一个：

阈值。

```
ssthresh
```

Slow Start Threshold。

例如：

```
64KB
```

到：

64KB。

停止：

指数。

开始：

线性。

---

# Congestion Avoidance

为什么：

变：

线性？

因为：

现在：

已经：

接近：

网络：

极限。

不能：

继续：

指数。

否则：

马上：

拥塞。

于是：

变成：

```
64

65

66

67

68
```

慢慢：

探测。

---

# TCP 像不像人在走路？

其实：

非常像。

陌生房间。

开始：

```
小步

↓

越来越快

↓

快撞墙

↓

慢一点
```

TCP：

也是：

一样。

不断：

试探。

---

# TCP 怎么知道撞墙？

终于：

最经典。

只有：

两个：

信号。

```
Timeout
```

或者：

```
Duplicate ACK
```

除此之外。

没有。

---

# Timeout

说明：

很严重。

包：

很久：

没回来。

TCP：

认为：

网络：

崩了。

于是：

```
cwnd

↓

1 MSS
```

重新：

Slow Start。

---

# Duplicate ACK

例如：

```
ACK=1000

ACK=1000

ACK=1000
```

连续：

三个。

TCP：

猜：

不是：

整个：

网络：

坏。

只是：

一包：

丢了。

于是：

Fast Retransmit。

不用：

Timeout。

---

# Fast Recovery

以前：

TCP：

看到：

丢包。

直接：

```
cwnd=1
```

后来：

发现：

太浪费。

因为：

网络：

其实：

没有：

完全：

坏。

于是：

Fast Recovery：

出现。

只：

降低：

一半。

继续：

发送。

例如：

```
64KB

↓

32KB
```

然后：

继续：

Congestion Avoidance。

不用：

重新：

Slow Start。

---

# 现在整个 TCP 已经完整了

我们可以把整个发送过程串起来：

```
                Application
                      │
                      ▼
                send()
                      │
                      ▼
            Send Buffer（发送缓冲区）
                      │
                      ▼
        可发送数据 = min(rwnd, cwnd)
                      │
                      ▼
               TCP Segment
                      │
                      ▼
                 Internet
                      │
                      ▼
            Receive Buffer（接收缓冲区）
                      │
                      ▼
                   recv()
```

其中：

* `rwnd` 决定**接收方还能接多少**。
* `cwnd` 决定**发送方认为网络还能承受多少**。
* 实际能够在网络中"飞行"而尚未确认的数据量，受两者共同限制。

---

# 但这里还有最后一个拼图

你有没有发现，我们一直在说：

```
1 MSS

2 MSS

4 MSS
```

可是：

**MSS 到底是什么？**

为什么不是：

```
1500 Byte
```

为什么：

TCP：

不是：

按：

MTU。

为什么：

还有：

MSS。

这背后涉及：

```
Ethernet

↓

IP

↓

TCP

↓

MSS

↓

Fragment
```

这一整套链路层与网络层的关系。

---
<!-- 
## 我建议下一章讲：

> **MTU、MSS、分片（Fragmentation）与 Path MTU Discovery（PMTUD）**

这是网络编程和后端面试中非常高频的主题，也是很多人容易混淆的几个概念。理解了它们，你就能回答诸如：

* 为什么以太网常见 MTU 是 1500？
* 为什么 TCP 常见 MSS 是 1460？
* 为什么 IP 分片通常应该尽量避免？
* Path MTU Discovery 为什么可能导致某些连接"卡死"？

这也是 TCP 数据真正如何在网络中传输的最后一块基础拼图。 -->
