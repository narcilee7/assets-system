# Linux Basic

---

# Linux 基础 RoadMap

```text
Linux Kernel
│
├── Part 1 系统启动
│     Boot
│     Init(Systemd)
│
├── Part 2 Process
│     Process
│     Thread
│     Context Switch
│     Signal
│     Daemon
│
├── Part 3 Memory
│     Virtual Memory
│     Page
│     mmap
│     NUMA
│     HugePage
│
├── Part 4 File System
│     VFS
│     inode
│     dentry
│     ext4
│     OverlayFS
│
├── Part 5 IO
│     Blocking
│     Nonblocking
│     Select
│     Poll
│     Epoll
│     io_uring
│
├── Part 6 Network
│     Socket
│     TCP/IP
│     Routing
│     Netfilter
│
├── Part 7 Security
│     Permission
│     ACL
│     SELinux
│     Capability
│
├── Part 8 Container
│     Namespace
│     cgroup
│     chroot
│
└── Part 9 Observability
      ps
      top
      vmstat
      iostat
      sar
      perf
      strace
```

---

# Part 1 Process（★★★★★）

这是面试频率最高的模块。

## 面试题 1：进程和线程有什么区别？

考察点：

Linux 内核怎么看待 Thread。

很多人回答：

> 一个是资源单位，一个是调度单位。

这只是教材答案。

Linux 真正实现：

> Thread 本质也是 Process。

Linux 内核只有：

```
task_struct
```

无论：

```
fork()

clone()
```

最终都是：

```
task_struct
```

区别：

clone 是否共享：

```
Memory

File Descriptor

Signal

Filesystem

Namespace
```

所以：

Linux：

没有真正意义上的 Thread。

POSIX Thread：

其实：

```
clone()
```

创建出来的轻量级 Process。

这是高级面试喜欢问的点。

---

## 面试题 2：fork() 做了什么？

很多人回答：

复制进程。

实际上：

不会立即复制内存。

Linux：

采用：

```
Copy On Write
```

fork：

```
Parent
```

```
Page Table
```

↓

```
Child
```

共享：

```
Physical Page
```

直到：

有人写：

```
page fault

↓

copy
```

所以：

fork：

速度非常快。

---

## 面试题 3：exec() 做了什么？

很多人：

fork

之后：

```
exec()
```

真正：

加载：

ELF。

替换：

```
Code

Heap

Stack

Data
```

PID：

保持。

这也是：

Shell：

工作的方式。

---

## 面试题 4：为什么 fork()+exec()？

因为：

Unix 哲学。

fork：

复制环境。

exec：

替换程序。

例如：

Shell：

```
fork()

↓

child

↓

exec(ls)
```

Parent：

继续：

等待。

---

## 面试题 5：僵尸进程是什么？

Child：

退出：

Kernel：

保留：

```
Exit Code

PID

Statistics
```

等待：

```
wait()
```

Parent：

回收。

如果：

一直：

不回收。

Zombie。

---

## 面试题 6：孤儿进程呢？

Parent：

先死。

Child：

还活着。

Kernel：

交给：

```
init

(systemd)
```

收养。

---

## 面试题 7：什么是 Daemon？

Daemon：

后台服务。

特点：

* 脱离终端
* 无控制终端
* 长时间运行
* systemd 管理

例如：

```
sshd

nginx

dockerd

containerd
```

---

# Part 2 Memory（★★★★★）

## 面试题 8：为什么需要虚拟内存？

目的：

不是：

扩大内存。

真正目的：

```
Isolation

Protection

Sharing

Lazy Allocation
```

优点：

* 每个进程看到连续地址空间
* 防止互相访问
* mmap
* COW

---

## 面试题 9：什么是 Page？

Linux：

按：

```
Page
```

管理内存。

通常：

```
4KB
```

现代：

支持：

HugePage：

```
2MB

1GB
```

数据库：

喜欢。

---

## 面试题 10：Page Fault 是什么？

CPU：

访问：

不存在：

Page。

进入：

Kernel。

Kernel：

负责：

```
Load

Allocate

Swap In
```

然后：

继续执行。

---

## 面试题 11：什么是 mmap？

传统：

```
read()

↓

copy kernel

↓

copy user
```

mmap：

```
File

↓

Virtual Memory
```

直接：

映射。

减少：

copy。

Redis：

Elasticsearch：

大量使用。

---

# Part 3 FileSystem（★★★★★）

## 面试题 12：inode 是什么？

很多人：

误认为：

inode：

就是文件。

其实：

inode：

保存：

```
Permission

Owner

Block

Time

Size
```

文件名：

不在：

inode。

而：

Directory：

保存：

```
filename

↓

inode
```

所以：

```
ln
```

硬链接：

就是：

多个：

filename。

---

## 面试题 13：软链接和硬链接？

硬链接：

多个：

inode。

（准确地说是多个目录项指向同一个 inode。）

软链接：

新的：

inode。

内容：

保存：

路径。

---

## 面试题 14：为什么删除文件磁盘没释放？

经典题。

原因：

```
inode

Reference > 0
```

例如：

程序：

打开：

log。

rm：

删除。

但是：

FD：

还开着。

inode：

不能释放。

需要：

关闭：

FD。

---

# Part 4 IO（★★★★★）

这里就是：

Go：

Node：

Python：

高频。

典型问题：

* Blocking IO
* Nonblocking IO
* IO Multiplexing
* epoll
* io_uring

这部分你已经系统学习过。

---

# Part 5 Network

面试：

Linux：

网络：

主要：

Socket。

例如：

Socket：

生命周期？

```
socket

bind

listen

accept

recv/send

close
```

---

# Part 6 Container（★★★★★）

这是云原生：

重点。

## 面试题 15：Docker 为什么快？

因为：

没有：

Guest OS。

共享：

Host Kernel。

利用：

```
Namespace

Cgroup

OverlayFS
```

---

## 面试题 16：Namespace 有哪些？

六大经典：

```
PID

NET

MNT

IPC

UTS

USER
```

现代：

还有：

```
CGROUP

TIME
```

作用：

分别隔离进程、网络、挂载点、IPC、主机名、用户与组，以及 cgroup 和时间命名空间。

---

## 面试题 17：cgroup 是什么？

限制：

```
CPU

Memory

IO

PID
```

并：

统计：

资源。

Kubernetes：

Resource Limit：

就是：

基于：

cgroup。

---

# Part 7 Linux 运维

经常：

问：

怎么看：

机器。

重点：

```
ps

top

free

vmstat

iostat

sar

netstat

ss

lsof

strace

perf
```

例如：

CPU：

100%。

怎么查？

回答：

```
top

↓

PID

↓

pidstat

↓

perf

↓

strace
```

形成：

定位链路。

---
