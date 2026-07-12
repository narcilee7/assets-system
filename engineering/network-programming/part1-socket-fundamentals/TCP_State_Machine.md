# TCP State Machie

真正的工程师应该问的是：

> **为什么 TCP 必须设计成一个有限状态机（FSM）？**

如果这个问题没有回答，后面所有状态都只是名字。

---

# Chapter 4：TCP State Machine

## 第一问：为什么需要状态（State）？

假设没有状态。

客户端：

```text
send()
```

服务器：

```text
recv()
```

好像很简单。

但是考虑下面几个事件：

```text
① 收到 SYN

② 收到 ACK

③ 收到 FIN

④ 收到 RST

⑤ 超时

⑥ 收到重复 ACK

⑦ 收到乱序包
```

同一个 ACK，在不同阶段意义完全不同。

例如：

连接建立阶段：

```text
ACK
```

意味着：

> 三次握手完成。

连接关闭阶段：

```text
ACK
```

意味着：

> 对方确认了 FIN。

数据传输阶段：

```text
ACK
```

意味着：

> 收到了新的数据。

所以：

TCP 必须知道：

> **我现在处于什么阶段？**

这就是：

State。

---

## 第二问：什么叫有限状态机（FSM）？

状态机：

其实就是：

```text
Current State

+

Event

↓

Next State
```

例如：

```text
Current:

LISTEN

↓

收到 SYN

↓

变成：

SYN_RECV
```

不是：

收到 SYN

就一定：

建立连接。

必须：

结合：

当前状态。

所以：

TCP：

实际上：

一直在：

```javascript
while(true){

    event = wait_packet();

    state = transition(state,event);

}
```

Linux TCP 内核本质上就是不断根据**当前状态 + 收到的报文（或定时器事件）**执行状态迁移。

---

# TCP 一共有多少状态？

RFC 793 定义了 11 个经典状态：

```text
CLOSED

LISTEN

SYN_SENT

SYN_RECEIVED

ESTABLISHED

FIN_WAIT_1

FIN_WAIT_2

CLOSE_WAIT

CLOSING

LAST_ACK

TIME_WAIT
```

不要背。

我们分类。

---

# 第一类

未连接状态。

只有：

```text
CLOSED
```

什么都没有。

socket()

刚创建：

就是：

```text
CLOSED
```

---

# 第二类

等待连接。

服务器：

```text
listen()
```

以后：

进入：

```text
LISTEN
```

说明：

> 我准备好了。

但是：

没有：

Client。

---

# 第三类

连接建立阶段

只有：

两个。

```text
SYN_SENT
```

客户端。

```text
connect()
```

以后：

发送：

SYN。

进入：

```text
SYN_SENT
```

为什么？

因为：

正在等待：

SYN+ACK。

---

服务器：

收到：

SYN。

回复：

SYN ACK。

进入：

```text
SYN_RECEIVED
```

为什么？

因为：

正在等待：

第三次：

ACK。

所以：

这两个状态：

其实：

就是：

```text
Client：

Waiting ACK

Server：

Waiting ACK
```

都是：

等待。

---

# 第四类

连接建立完成。

只有：

```text
ESTABLISHED
```

所有：

真正：

业务。

全部：

发生：

这里。

例如：

```text
HTTP

Redis

MySQL

RPC

WebSocket
```

全部：

ESTABLISHED。

---

# 第五类

关闭连接。

这是：

最难。

其实：

只需要：

理解：

一句话。

> **TCP 是全双工（Full Duplex）。**

什么意思？

例如：

Client：

```text
========>
```

Server：

```text
<========
```

两条：

独立。

所以：

关闭：

也必须：

两条：

分别关闭。

这就是：

所有：

FIN 状态：

存在原因。

---

## 举例

客户端：

```text
FIN
```

发送。

进入：

```text
FIN_WAIT_1
```

什么意思？

> 我已经发 FIN。

等待：

ACK。

---

服务器：

收到。

回复：

ACK。

进入：

```text
CLOSE_WAIT
```

为什么？

因为：

服务器：

知道：

客户端：

不会再发。

但是：

服务器：

还能发。

所以：

```text
Close Wait
```

意思：

> **等待应用程序决定什么时候关闭自己的发送方向。**

很多线上故障正是因为应用程序迟迟没有 `close()`，导致大量连接停留在 `CLOSE_WAIT`。

---

客户端：

收到：

ACK。

进入：

```text
FIN_WAIT_2
```

什么意思？

客户端：

已经：

关闭：

发送。

现在：

等待：

服务器：

FIN。

---

服务器：

终于：

发：

FIN。

进入：

```text
LAST_ACK
```

什么意思？

服务器：

最后：

等待：

ACK。

收到：

就：

结束。

---

客户端：

收到：

FIN。

回复：

ACK。

进入：

```text
TIME_WAIT
```

为什么？

因为：

最后：

ACK：

可能：

丢。

客户端：

必须：

等等。

所以：

TIME_WAIT。

---

# 其实所有状态可以重新理解

不要记名字。

只记：

三个阶段。

```text
Connection Setup

↓

Data Transfer

↓

Connection Teardown
```

建立：

```text
LISTEN

SYN_SENT

SYN_RECEIVED
```

通信：

```text
ESTABLISHED
```

关闭：

```text
FIN_WAIT_1

FIN_WAIT_2

CLOSE_WAIT

LAST_ACK

CLOSING

TIME_WAIT
```

一下子就简单了。

---

# 面试官真正喜欢问什么？

到这里，还只是基础。

真正高频的问题不是：

> TCP 有哪些状态？

而是这些：

* 为什么 `TIME_WAIT` 必须存在？
* 为什么主动关闭方进入 `TIME_WAIT`？
* `TIME_WAIT` 为什么要等待 **2MSL**？
* 为什么会有大量 `CLOSE_WAIT`？
* `FIN_WAIT_2` 为什么可能持续很久？
* `RST` 在状态机中起什么作用？
* 半关闭（Half Close）是什么？`shutdown()` 和 `close()` 有什么区别？
* 什么情况下会进入 `CLOSING`，为什么这个状态很少见？

这些问题实际上都是对**状态机设计思想**的考察，而不是对状态名称的记忆。

---
