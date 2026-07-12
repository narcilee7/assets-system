# TCP Segement
我认为这是一个非常好的顺序。

> **TCP Segment（TCP 报文） → TCP 状态机 → TCP 算法（重传、滑动窗口、拥塞控制）**

这是 RFC 的思路，也是 Linux 内核实现的思路。

---

# Chapter 5 TCP Segment（TCP 报文）

这一章，我们不学习 Header。

我们学习一个更重要的问题。

> **TCP 为什么要设计成现在这个样子？**

如果把 TCP 看成一种"语言"，那么 TCP Segment 就是它的"句子"。

状态机不会凭空变化。

它永远依据收到的 Segment。

也就是说：

```text
收到 Segment

↓

解析 Header

↓

更新 State

↓

更新 Sequence

↓

发送新的 Segment
```

整个 TCP 就是在不断处理 Segment。

---

# 一个 TCP Segment 长什么样？

经典结构：

```text
+-----------------------------------------------------------+
| Source Port        | Destination Port                     |
+-----------------------------------------------------------+
| Sequence Number                                        |
+-----------------------------------------------------------+
| Acknowledgment Number                                  |
+-----------------------------------------------------------+
| Data Offset | Flags | Window Size                        |
+-----------------------------------------------------------+
| Checksum    | Urgent Pointer                            |
+-----------------------------------------------------------+
| Options (MSS、SACK、Timestamp...)                       |
+-----------------------------------------------------------+
| Payload                                             ... |
+-----------------------------------------------------------+
```

很多书就是开始介绍这些字段。

**我觉得这是错误的。**

因为：

不知道为什么有这些字段。

---

# 第一问

为什么 TCP Header 里面没有：

```text
Source IP

Destination IP
```

很多人第一次都会疑惑。

TCP 怎么知道发给谁？

答案：

不知道。

因为：

TCP 根本不负责。

TCP：

只负责：

```text
Port

Sequence

ACK

Window
```

IP：

负责：

```text
Source IP

Destination IP
```

所以真正发送的是：

```text
Ethernet

↓

IP Header

↓

TCP Header

↓

Payload
```

也就是说：

TCP Header 只是整个网络包的一部分。

---

# 第二问

为什么 TCP 一定需要 Port？

很多人说：

为了区分程序。

这是结果。

真正原因是：

IP 只能找到：

机器。

例如：

```text
192.168.1.10
```

到了以后：

发现：

机器上：

有：

```text
Nginx

Redis

MySQL

SSH

Chrome
```

到底：

给谁？

于是：

TCP：

增加：

```text
Destination Port
```

于是：

形成：

```text
IP

↓

Machine

↓

Port

↓

Process
```

注意，严格来说内核是根据五元组/四元组找到对应 Socket，再由 Socket 交给对应进程，而不是直接靠 Port 找进程。

---

# 第三问

为什么还需要 Source Port？

例如：

Chrome：

打开：

100 个网页。

都是：

```text
https://example.com:443
```

服务器：

回复：

都来自：

```text
443
```

Chrome：

怎么知道：

哪个包：

属于：

哪个标签？

于是：

客户端：

随机：

分配：

```text
52341

52342

52343
```

形成：

```text
(src_ip,
 src_port,
 dst_ip,
 dst_port)
```

TCP 四元组。

这样：

每个连接：

唯一。

---

# 第四问

为什么 Sequence Number？

这是 TCP 的灵魂。

TCP：

不是：

Message。

而是：

Byte Stream。

例如：

客户端：

```text
Hello World
```

实际上：

不是：

一个整体。

而是：

```text
Byte 0

Byte 1

Byte 2

...
```

所以：

Sequence Number：

不是：

包编号。

而是：

**第一个字节的编号。**

这一点极其重要。

例如：

发送：

1000 Byte。

```text
Seq = 5000
```

意味着：

这一包：

包含：

```text
5000

~

5999
```

不是：

第：

5000 个包。

---

# 为什么按字节编号？

思考一个问题。

如果：

按：

Packet。

```text
Packet1

Packet2

Packet3
```

第二包：

丢了。

但是：

第一包：

1500 Byte。

第二包：

300 Byte。

第三包：

800 Byte。

怎么知道：

到底：

缺了：

多少？

不知道。

所以：

TCP：

按：

Byte。

于是：

重传：

可以：

精确。

---

# 第五问

ACK Number

很多人：

认为：

ACK：

表示：

收到。

其实：

不是。

ACK：

表示：

> **下一个期望收到的字节序号（Next Expected Byte）。**

举例：

客户端：

发送：

```text
Seq = 1000

Length = 500
```

服务器：

收到：

以后。

ACK：

不是：

1000。

而是：

```text
ACK = 1500
```

意思：

> **1000~1499 我都收到了，请从 1500 开始继续发送。**

这叫：

累计确认（Cumulative ACK）。

---

# 为什么不是 ACK 每个包？

例如：

收到：

```text
1000~1499

1500~1999

2000~2499
```

TCP：

可以：

回复：

```text
ACK = 2500
```

一句话：

全部确认。

不用：

三个 ACK。

减少：

流量。

当然，现代 TCP 还支持 **SACK（Selective Acknowledgment）**，用于更精确地描述哪些数据块已经收到，这是累计 ACK 的增强能力。

---

# 第六问

Flags

很多人：

背：

```text
SYN

ACK

FIN

RST

PSH
```

其实：

它们：

就是：

状态机：

事件。

例如：

状态：

```text
LISTEN
```

收到：

```text
SYN
```

状态：

变化。

收到：

```text
FIN
```

状态：

变化。

收到：

```text
RST
```

直接：

结束。

所以：

Flags：

就是：

**状态机输入。**

---

# 第七问

Window

后面：

滑动窗口：

整整：

一章。

这里只理解：

一句。

TCP：

不会：

无限：

发送。

因为：

接收方：

Buffer：

有限。

于是：

每个：

ACK：

都会：

告诉：

发送方：

```text
我还能接收：

65535 Byte
```

这就是：

Receive Window。

所以：

Window：

不是：

发送窗口。

而是：

**接收方通告给发送方的可用接收窗口（Advertised Receive Window）**。

发送方会结合自己的拥塞窗口（Congestion Window）决定最终还能发送多少数据。

---

# 到这里，你会发现 Header 不是字段集合

而是一套协议状态。

如果重新分类：

| 字段       | 本质职责                         |
| -------- | ---------------------------- |
| Port     | 身份（Identity）                 |
| Sequence | 数据位置（Ordering）               |
| ACK      | 确认进度（Acknowledgment）         |
| Flags    | 控制状态（Control）                |
| Window   | 流量控制（Flow Control）           |
| Checksum | 完整性校验（Integrity）             |
| Options  | 能力协商（Capability Negotiation） |

这样理解，比单纯背 Header 更容易形成整体框架。

---
