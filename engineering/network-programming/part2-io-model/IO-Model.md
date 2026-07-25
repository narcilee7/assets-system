# IO & Event Driven Programming**

---

# 我会这样设计 RoadMap

```
Phase 2

IO Models
│
├── Blocking IO
├── NonBlocking IO
├── IO Multiplexing
├── Signal Driven IO
└── Async IO

↓

select

↓

poll

↓

epoll

↓

Reactor

↓

Event Loop

↓

asyncio

↓

libuv

↓

Go Runtime Netpoll

↓

Node.js Event Loop

↓

Netty
```

注意。

**这是一个故事。**

不是很多知识。

---

## 为什么？

因为：

你现在的技术栈：

Node

Go

Python

全部都是：

```
Event Loop
```

只是：

长得不一样。

例如：

Node

```
JavaScript

↓

libuv

↓

epoll
```

Python

```
asyncio

↓

SelectorEventLoop

↓

epoll
```

Go

```
goroutine

↓

runtime scheduler

↓

netpoll

↓

epoll
```

是不是突然统一了？

三个语言。

底层都是：

```
epoll
```

Java

```
Netty

↓

NIO

↓

epoll
```

也是。

所以：

你以后不会学：

四套东西。

而是一套。

---

# 我建议下一章只有一个问题

这是我最喜欢问高级工程师的问题。

> **为什么需要 IO Model？**

很多教程上来就是：

```
Blocking IO

NonBlocking IO

IO Multiplexing
```

我觉得这是错误的。

应该先问：

> **为什么 Blocking IO 不够？**

如果这个问题回答不了。

后面的：

select

poll

epoll

都会变成 API。

而不是思想。

---

## 我们下一阶段的学习目标

不是会写：

```python
selectors.DefaultSelector()
```

不是会写：

```go
net.Listen()
```

不是会写：

```ts
net.createServer()
```

而是最终回答一个问题：

> **为什么 Node.js 用一个线程就能支撑几万连接？**

为了回答这一个问题，我们会一步步推导：

```
Blocking IO
    ↓
Non-Blocking IO
    ↓
select
    ↓
poll
    ↓
epoll
    ↓
Reactor
    ↓
Event Loop
    ↓
libuv
    ↓
Node.js
```

当这条链真正打通之后，你会发现：

* Node.js 的 Event Loop
* Python `asyncio`
* Go `netpoll`
* Java Netty
* Rust Tokio

都会变成同一种架构在不同语言中的实现。

我认为，这也是最符合你作为 **Full Stack / AI Native Engineer** 的下一阶段学习重点。
