# 第一阶段：TCP 是什么

面试第一句一般就是：

> TCP 为什么存在？

TCP（Transmission Control Protocol）解决的是：

> **在不可靠(IP)网络上提供可靠的字节流传输。**

IP 能做到：

* 发包
* 路由

不能做到：

* 不丢包
* 不重复
* 有序
* 流控
* 拥塞控制

TCP 全补上。

因此 TCP =

```
Reliable
Ordered
Byte Stream
Connection Oriented
Full Duplex
```

逐个解释。

---

# Byte Stream（字节流）

很多人第一句话就说错。

TCP

不是

```
Message
```

而是

```
Stream
```

例如：

客户端

```
send("Hello")
send("World")
```

服务器

可能收到

```
HelloWorld
```

或者

```
Hel
loWo
rld
```

甚至

```
HelloW
orld
```

都合法。

所以：

TCP 没有消息边界。

---

为什么？

TCP 内部维护：

```
发送缓冲区

Receive Buffer
```

应用：

```
write()
```

↓

复制进入 Send Buffer

↓

TCP 自己决定：

什么时候发

发多少

是否合并

因此：

send()

不是发包。

而是

**写入发送缓冲区。**

---

# Connection Oriented

TCP：

先建立连接

```
SYN

↓

SYN ACK

↓

ACK
```

三次握手。

为什么不是两次？

后面讲。

---

# Full Duplex

客户端

可以：

```
Client ---> Server
```

同时

```
Server ---> Client
```

两个方向互不影响。

每个方向：

都有：

```
Sequence Number

ACK Number

Window

Buffer
```

实际上：

TCP 是

两条单向流。

---

# Reliable

TCP 保证：

* 不丢
* 不重
* 有序

依赖：

```
Sequence Number

ACK

Retransmission

Sliding Window
```

---

# 第二阶段：Socket

Socket 是什么？

很多人说：

TCP Socket。

其实：

Socket 只是

内核提供的接口。

TCP

只是 Socket 的一种。

还有：

```
UDP

UNIX Socket

RAW Socket
```

---

Socket 生命周期：

```
socket()

↓

bind()

↓

listen()

↓

accept()

↓

recv()

↓

send()

↓

close()
```

必须非常熟。

---

# 第三阶段：实现 Echo Server

Python：

```python
import socket

server = socket.socket()

server.bind(("0.0.0.0", 8888))

server.listen()

while True:

    conn, addr = server.accept()

    while True:
        data = conn.recv(1024)

        if not data:
            break

        conn.sendall(data)

    conn.close()
```

这是最原始版本。

---

Client：

```python
import socket

client = socket.socket()

client.connect(("127.0.0.1", 8888))

while True:
    msg = input("> ")

    client.sendall(msg.encode())

    print(client.recv(1024).decode())
```

这是所有网络编程的 Hello World。

---

# 面试继续问

为什么：

```
accept()

recv()
```

要分开？

因为：

```
accept()

建立连接
```

得到的是：

```
新的 Socket
```

监听 Socket：

继续监听。

新的 Socket：

负责通信。

所以：

```
Listen Socket

↓

Accept

↓

Conn Socket
```

永远别混。

---

# 第四阶段：TCP 三次握手

整个过程：

```
Client

SYN(seq=x)

------------>

Server

SYN ACK(seq=y ack=x+1)

<------------

Client

ACK(ack=y+1)

------------>
```

---

为什么三次？

核心：

双方：

都要确认：

发送能力

接收能力

同步初始序号。

---

如果两次：

会导致：

历史连接

误建立。

---

# 为什么要随机 Sequence Number？

避免：

```
历史数据

重复连接

数据串台
```

---

# 第五阶段：四次挥手

```
FIN

ACK

FIN

ACK
```

为什么四次？

因为：

关闭：

两个方向：

独立。

例如：

客户端：

```
我不发了。
```

服务器：

```
我还能发。
```

因此：

不能一次结束。

---

# TIME_WAIT

为什么：

客户端：

最后：

进入：

TIME_WAIT？

为了：

保证：

最后 ACK

能重发。

否则：

服务器：

收不到最后 ACK。

---

TIME_WAIT：

2MSL。

为什么？

后面讲 MSL。

---

# 第六阶段：TCP Header

一定会问：

TCP Header：

有什么？

```
Source Port

Destination Port

Sequence

ACK

Flags

Window

Checksum

Urgent Pointer
```

Flags：

```
SYN

ACK

FIN

RST

PSH

URG
```

全部要知道。

---

# 第七阶段：Sliding Window

TCP：

不是：

发一个：

等一个。

而是：

```
Send Window
```

例如：

```
Window = 5
```

一次：

可以：

连续发送：

```
1

2

3

4

5
```

收到 ACK：

窗口滑动。

因此：

吞吐量：

极大提高。

---

# 第八阶段：Flow Control

Window：

谁决定？

接收端。

例如：

Receive Buffer：

满了。

发送：

```
Window = 0
```

发送端：

暂停。

这就是：

流控。

---

# 第九阶段：Congestion Control

网络：

堵了。

怎么办？

TCP：

不能一直发。

经典算法：

```
Slow Start

Congestion Avoidance

Fast Retransmit

Fast Recovery
```

必须知道。

尤其：

```
cwnd

ssthresh
```

---

# 第十阶段：为什么粘包？

经典。

其实：

TCP

没有：

粘包。

只有：

没有消息边界。

原因：

```
Nagle

MSS

MTU

Buffer
```

解决：

自己设计协议：

```
Length + Body
```

例如：

```
4 bytes

length

+

payload
```

这是所有 RPC：

HTTP2

gRPC

Redis

Kafka

全部采用的方法。

---

# 第十一阶段：TCP 为什么可靠？

必须完整回答。

依赖：

① Sequence Number

保证：

有序。

② ACK

确认收到。

③ Timeout

超时重传。

④ Sliding Window

流水线发送。

⑤ Checksum

校验。

⑥ Flow Control

避免接收方爆掉。

⑦ Congestion Control

避免网络爆掉。

---

# 第十二阶段：网络编程真正开始

Echo：

只是开始。

真正工程：

马上进入：

```
一个连接

↓

一个线程
```

↓

线程爆炸。

然后：

进入：

```
select
```

↓

```
poll
```

↓

```
epoll
```

↓

Reactor

↓

Netty

↓

libevent

↓

libuv

↓

Tokio

↓

asyncio

↓

io_uring

```

这才是真正网络服务器。

---

## 推荐的学习路线

我建议按实现复杂度逐步推进，每一步都亲自实现并抓包验证：

1. **阻塞版 Echo Server/Client**
   - `socket()`
   - `bind()`
   - `listen()`
   - `accept()`
   - `recv()`
   - `sendall()`
   - `close()`

2. **多客户端支持**
   - 一个连接一个线程（Thread-per-Connection）
   - 使用线程池管理连接

3. **非阻塞 I/O**
   - Socket 非阻塞模式
   - `select`
   - `poll`
   - `epoll`（Linux）

4. **协议设计**
   - 解决 TCP 字节流无边界问题
   - 长度字段 + Payload
   - 半包与拆包处理

5. **内核机制**
   - 三次握手、四次挥手
   - TCP 状态机（`LISTEN`、`SYN_SENT`、`ESTABLISHED`、`FIN_WAIT_1` 等）
   - 滑动窗口
   - 流量控制
   - 拥塞控制
   - 重传机制（超时重传、快速重传）
   - Nagle 算法、Delayed ACK、KeepAlive、TIME_WAIT、MSL

6. **抓包与调试**
   - Wireshark 抓取完整握手、挥手过程
   - 使用 `tcpdump` 抓包
   - 使用 `ss` 或 `netstat` 查看 Socket 状态
   - 使用 `lsof` 查看端口占用

---

对于准备**Python 专家/架构师**面试，我建议把这个主题扩展成一个完整系列，而不是停留在 Echo 示例。整个系列可以按照工程实践递进：

- 第 1 讲：实现阻塞版 TCP Echo（Socket API 全流程）
- 第 2 讲：实现线程池版 Echo Server（并发模型）
- 第 3 讲：基于 `selectors` 的 Reactor（`select`/`poll`/`epoll`）
- 第 4 讲：实现自定义二进制协议（长度前缀、拆包、粘包）
- 第 5 讲：从零实现高性能 TCP Server（连接管理、缓冲区、事件循环）
- 第 6 讲：深入 Linux TCP（状态机、拥塞控制、内核参数、抓包分析）
- 第 7 讲：理解 `asyncio`、`uvloop`、Netty、Go netpoll 等现代网络框架与 Reactor/Proactor 模型的关系。

如果把这七部分全部掌握，TCP 网络编程相关的问题基本都能覆盖到较高水平的工程面试要求。
```
