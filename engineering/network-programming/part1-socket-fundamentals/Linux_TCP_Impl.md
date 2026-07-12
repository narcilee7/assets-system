# Chapter 3：Connection Establishment（连接建立）

上一节，我们留下了一个问题：

> `listen()` 到底做了什么？

很多人回答：

> 开始监听端口。

这只是现象。

真正发生的是：

```text
socket()

↓

bind()

↓

listen()

↓

Listening Socket
```

此时，内核开始维护两类资源：

```text
Listening Socket

├── SYN Queue（半连接队列）
└── Accept Queue（已建立连接队列）
```

这是 TCP Server 最重要的数据结构之一。

---

# 为什么需要两个队列？

先不要急着记名字。

先想一个问题。

假设：

客户端：

```text
SYN
```

发来了。

服务器怎么办？

有两种选择。

第一种：

立即创建连接。

第二种：

什么都不做。

都不行。

为什么？

因为：

客户端只是发了：

```text
SYN
```

它还没有回复：

```text
ACK
```

所以：

服务器不知道：

> 对方是不是真的准备建立连接。

因此：

**不能立即认为连接建立完成。**

但是：

服务器又必须：

记住：

> 有人发来过 SYN。

否则：

后面：

ACK 来了。

服务器：

不知道：

ACK 属于谁。

所以：

需要：

一个地方：

临时保存：

半完成连接。

于是：

SYN Queue 出现。

---

# SYN Queue

里面放什么？

不是：

真正建立好的连接。

而是：

```text
SYN Received
```

状态。

例如：

```text
Client

SYN(seq=100)

────────────>

Server
```

服务器：

收到以后：

立即：

创建：

一个：

Request Socket。

注意：

不是：

最终：

tcp_sock。

Linux 内核实际上会先创建一个较轻量级的请求对象（通常称为 `request_sock`），用于记录这次握手所需的信息，而不是立即创建完整的连接资源。

里面记录：

```text
Client IP

Client Port

ISN

Timer

TCP Option

MSS

Window Scale
```

然后：

放进：

```text
SYN Queue
```

所以：

SYN Queue：

保存的是：

> 等待第三次握手完成的请求。

---

# 为什么不是直接创建完整 Socket？

这是 Google 很喜欢问的问题。

因为：

完整：

TCP Socket：

很贵。

里面有：

```text
Send Buffer

Receive Buffer

Congestion State

ACK Queue

Sequence

Timer

Hash
```

如果：

攻击者：

疯狂：

发送：

```text
SYN
```

永远：

不回复 ACK。

那么：

服务器：

会：

OOM。

于是：

Linux：

先创建：

轻量级：

Request Socket。

只有：

第三次握手：

完成。

才：

升级。

这就是：

SYN Flood

为什么存在。

也是：

SYN Cookie

为什么存在。

---

# 第三次握手来了

客户端：

```text
ACK
```

到了。

服务器：

终于确认：

这个客户端：

是真的。

于是：

发生：

最重要的一步。

```text
request_sock

↓

tcp_sock
```

真正：

Connection Socket：

创建。

随后：

进入：

```text
Accept Queue
```

所以：

Accept Queue：

里面：

放的是：

真正：

ESTABLISHED

连接。

---

# accept() 到底干了什么？

终于来到：

这一章：

最经典的问题。

很多人认为：

```python
conn, addr = server.accept()
```

是在：

建立连接。

不是。

真正：

连接：

早就：

建立好了。

accept()

只是：

```text
Accept Queue

↓

pop()

↓

返回 fd
```

也就是说：

accept()

本质：

就是：

```cpp
queue.pop();
```

如果：

Accept Queue：

为空。

那么：

```text
accept()

↓

阻塞
```

直到：

新的连接：

进入。

这是一个非常重要的认知转变：**TCP 三次握手由内核自动完成，应用程序直到调用 `accept()` 时，才“领取”这个已经建立好的连接。**

---

# 为什么 accept() 可以阻塞？

因为：

Accept Queue：

可能：

空。

例如：

```text
Accept Queue

[]
```

此时：

没有：

连接。

于是：

Kernel：

把：

当前线程：

睡眠。

等：

新的：

Connection：

进入。

再：

唤醒。

所以：

accept()

等待的是：

**队列里是否有已完成握手的连接。**

不是：

等待：

三次握手。

这一点：

很多人：

理解错。

---

# backlog 到底是什么？

大家都会写：

```c
listen(fd, 128);
```

这个：

128

是什么？

很多人说：

最大连接数。

错。

真正：

是：

**内核为监听 Socket 分配的排队能力**。

现代 Linux 中，它主要限制的是**Accept Queue（已完成连接队列）**的长度；半连接队列（SYN Queue）的容量还会受到内核参数（如 `tcp_max_syn_backlog`）影响，因此不能简单理解成“总连接数”。

所以：

真正：

最大连接：

可能：

几万。

backlog：

只是：

等待：

应用：

accept()

的：

排队能力。

---

# 为什么应用 accept() 太慢会出问题？

假设：

Accept Queue：

```text
[fd5]

[fd6]

[fd7]

...
```

已经：

满。

新的：

客户端：

连接。

怎么办？

内核：

只能：

拒绝。

于是：

客户端：

connect()

开始：

超时。

很多高并发服务器的问题，本质不是 TCP 不够快，而是**应用层处理连接的速度赶不上连接进入 Accept Queue 的速度**。

---

# 到这里，整个连接建立过程终于完整了

我们把整个过程串起来：

```text
Client                        Server

           socket()
           bind()
           listen()

SYN -------------------------->
                    创建 request_sock
                    放入 SYN Queue

      <-------------------- SYN+ACK

ACK -------------------------->
                    request_sock
                           │
                           ▼
                  创建 Connection Socket
                           │
                           ▼
                   放入 Accept Queue

                accept()
                     │
                     ▼
              返回新的 conn fd
```

注意两个关键点：

* **三次握手完成之前，应用程序完全不会参与，全部由内核协议栈处理。**
* **`accept()` 不负责建立连接，只负责从 Accept Queue 中取出一个已经建立好的连接，并返回对应的文件描述符。**

---

