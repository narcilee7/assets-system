# Socket

Socket是操作系统提供给用户态(User Space)访问网络协议栈(Kernel TCP/IP Stack)的一套编程接口(API抽象)

```plain text
Application

↓

socket()

↓

BSD Socket API

↓

Kernel TCP/IP Stack

↓

NIC Driver

↓

Network Card
```

Socket位于用户程序和内核之间

所以说Socket是TCP/UDP Protocol的一种用户态抽象

## Why need socket

如果没有Socket，用户程序怎么办

```
send SYN

↓

等待ACK

↓

维护重传队列

↓

维护Window

↓

维护ACK

↓

维护Sequence Number

↓

维护Buffer
```

这些都用户程序自己写，不现实。

Linux内核已经实现了一套TCP/IP协议栈

应用程序只需要

```
connect()
send()
recv()
close()
```

剩下的全部交给内核，Socket就是这层抽象

## Socket是一个对象么？

```Python
sock = socket.socket()
```

```Go
net.Conn
```
实际上，socket是一个内核对象(Kernel Object)

Linux内核中对应的是
```c
struct socket
```

它关联着更底层的网络状态，例如 TCP 会关联到 struct sock、struct tcp_sock 等内核数据结构。
不同语言中的 Socket、net.Conn 或 socket.socket，**本质上只是持有一个文件描述符（file descriptor）的用户态封装**。

所以上层应用都是包装了一层对象，真正工作的都是Linux Kernel。

## Socket在Linux中是什么？

Socket在Unix/Linux是一种文件描述符(File Descriptor)对应的内核对象。

Unix哲学：一切可以被定义为文件描述符

## 一个Socket是如何诞生的

```c
int fd = socket(AF_INET, SOCK_STREAM, 0);
```

这行代码发生了什么？

### Layer1：用户态

```c
socket(AF_INET, SOCK_STREAM, 0);
```

实际上进入libc

```
Application

↓

glibc socket()

↓

syscall()

↓

Linux Kernel
```

### Layer2：进入内核

CPU从User Mode切换到Kernel Mode

开始执行`sys_socket()`

内核看到：

```
AF_INET
SOCK_STREAM
IPPROTO_TCP
```

### 内核创建哪些对象？

先抽象成：

```
File Descriptor Table

fd=3
  │
  ▼
struct file
  │
  ▼
struct socket
  │
  ▼
struct sock
  │
  ▼
struct tcp_sock
```

注意：这里不是只有一个socket，Linux网络子系统实际上分了很多层。

#### `struct file`

这是VFS对象，因为Socket在Linux中也是一个文件

所以

```
read()
write()
close()
fcntl()
epoll()
```

全部能够统一工作

#### `struct socket`

BSD Socket 层。

主要负责：

Socket API。

例如：

```
bind

listen

accept

connect
```

都是这一层处理

#### `struct sock`

这是网络层真正的Socket。

这里面开始维护：

```
Receive Queue

Send Queue

Timers

State

Hash

Callback
```

#### 为什么socket()返回int？

返回的实际上是`File Descriptor`。

例如：
```
0 stdin

1 stdout

2 stderr

3 socket

4 file

5 pipe
```

所以
```c
send(fd)
recv(fd)
close(fd)
```

全部只需要一个整数，真正的对象在内核。

#### 为什么不返回一个指针？

为什么不是
```c
Socket *socket;
```

而是
```c
int fd;
```

##### 原因如下

1. 安全：用户不能直接访问内核对象
2. 隔离：内核可以随时移动对象
3. 统一抽象：任何I/O都可以

## Socket的生命周期

```
                 Server

socket()
    │
    ▼
bind()
    │
    ▼
listen()
    │
    ▼
accept() <──────────── Client connect()
    │
    ▼
ESTABLISHED
    │
recv()/send()
    │
shutdown()
    │
close()
```

### Socket初始化的时候是什么？

```c
int fd = socket(AF_INET, SOCK_STREAM, 0);
```

这个时候只有：

```
Application

↓

fd = 3

↓

Kernel Socket Object
```
内核里的TCP状态是：`TCP_CLOSE`

没有：

IP
Port
Peer
Sequence Number
Window
Connection

什么都没有，它只是一个TCP Socket容器。

#### socket()做了什么

新增：
```
File Descriptor

↓

struct file

↓

struct socket

↓

struct sock

↓

tcp_sock
```

但是所有字段：
```
local ip = NULL

local port = 0

peer ip = NULL

peer port = 0

state = CLOSED
```

所以`socket()`实际上只是向内核申请了一块用于TCP通信的状态机和缓冲区资源。

### 为什么要`bind()`?

`bind()`是绑定端口

#### **为什么需要绑定？**

TCP通信一定需要四元组

```
(src_ip,
 src_port,
 dst_ip,
 dst_port)
```

但是：

刚创建的时候：
```

src_ip = ?

src_port = ?
```


不知道。

所以：

`bind()`就是：告诉内核：以后请使用这个本地地址。

#### 为什么Client可以不`bind()`

因为这件事情Linux帮你做了
```
选择本地IP

↓

选择临时端口(ephemeral port)

↓

自动bind
```

所以：

实际上：

Client：

也是 bind 了。

只是：

Kernel 帮你完成。

### 为什么Listen()?

如果已经`bind()` -> 8000了
为什么还要`listen()`?
因为`bind`并不意味着愿意接受连接。
`bind`只是我拥有8000，`listen`才表示我现在开始监听连接请求。

于是内核开始创建监听的Queue

### Listen到底新增了什么？

`listen()`以后：
Socket 已经不是：
普通 TCP Socket。
而是：
Listening Socket。

它开始拥有：
```
SYN Queue
Accept Queue
```

### 为什么accept()会返回新的Scoket?

```python
conn, addr = server.accept()
```

为什么要有新conn，而不是`server.recv()`
因为：Listening Socket永远不能负责数据通信，它只负责

```
监听

↓

建立连接

↓

分发连接
```

真正通信的是：

**Connection Socket。**

所以内核发生了这样的事情：

```
Listening Socket (fd=3)

↓

Client A

↓

建立连接

↓

Connection Socket (fd=5)
```

第二个：

Listening Socket

↓

Client B

↓

Connection Socket (fd=6)

第三个：

Listening Socket

↓

Client C

↓

Connection Socket (fd=7)

于是：

fd=3

永远：

继续监听。

真正：

收数据：

都是：

fd=5

fd=6

fd=7

这里其实体现了一个非常经典的设计思想：

**监听连接（Connection Establishment）和数据传输（Data Transfer）是两种完全不同的职责，因此内核把它们拆成了两个不同的 Socket 对象。**

**如果监听 Socket 同时负责通信，那么它一次只能服务一个客户端，就失去了服务器能够同时处理大量连接的能力。**

### Socket身份的变化

```
socket()

↓

bind()

↓

listen()

↓

accept()
```
之前以为这些都是API，实际上每次都是Socket身份的变化。

```
socket()

↓

普通 TCP Socket

↓

bind()

↓

拥有本地身份

↓

listen()

↓

Listening Socket

↓

accept()

↓

Connection Socket
```
