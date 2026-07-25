# Reactor Pattern

Reactor 不是 Linux 提出的。

它不是：

API
系统调用
epoll 的一部分

它是一种软件架构模式（Architectural Pattern）。

## 为什么需要Reactor？

```c
events = epoll_wait(...)

for (event in events) {
  recv(fd);
}
```

这已经能工作。

但是，一个真正的服务器远不止 recv()。

例如一个 HTTP Server

```text
连接建立
    ↓
读取请求
    ↓
HTTP解析
    ↓
业务逻辑
    ↓
数据库
    ↓
序列化JSON
    ↓
send()
```

如果全部写在阻塞的epoll_wait()内，很快要加很多判断。

## Reactor Definition

Reactor = Event Demultiplexer + Event Dispatcher

1. 等待事件：`epoll_wait()`
2. 分发事件：`AcceptHandler` -> `ReadHandler` -> `WriteHandler` -> `CloseHandler`

Dispatcher

## Reactor做什么？

它不处理业务，它负责把事件交给正确的人处理。

```text
                Application

                     ▲
                     │

             Event Handler

      ReadHandler

      WriteHandler

      AcceptHandler

             ▲
             │

         Dispatcher

             ▲
             │

         epoll_wait()

             ▲
             │

            epoll

             ▲
             │

            Kernel
```

## Redis单Reactor

```text
                Thread

                  │

             epoll_wait()

                  │

          Dispatch Event

                  │

           Read / Write

                  │

          Execute Command
```

## 多Reactor，Netty、Nginx

```text
Main Reactor

↓

Accept

↓

Worker Reactor

↓

Read

↓

Business
```

## 为什么Node.js也是Reactor？

```javascript
server.on("connection");
```

其实都是handler。

底层
```text
JavaScript

↓

libuv

↓

epoll

↓

Dispatcher

↓

Callback
```

## 为什么Go看起来不像是Reactor？

```go
conn.Read()
```

不像是Callback，实际上Runtime偷偷帮忙做了Reactor

```text
goroutine

↓

net.Conn.Read()

↓

runtime.netpoll

↓

epoll

↓

goroutine 唤醒
```

Go把Reactor藏在了Runtime里。

## Python asyncio

```python
await reader.read()
```

```text
asyncio

↓

SelectorEventLoop

↓

epoll

↓

Callback

↓

Coroutine Resume
```

## 主流的运行时基本都是一个epoll+reactor架构

| 技术             | 底层 I/O        | Reactor 在哪里？      | 上层编程模型             |
| -------------- | ------------- | ----------------- | ------------------ |
| Redis          | epoll         | Redis 自己实现        | 单线程事件循环            |
| Nginx          | epoll         | Nginx             | 多 Reactor          |
| Node.js        | epoll + libuv | libuv             | Callback / Promise |
| Python asyncio | epoll         | asyncio EventLoop | Coroutine          |
| Go             | epoll         | runtime.netpoll   | Goroutine          |
| Netty          | epoll / NIO   | Netty             | Pipeline + Handler |
| Tokio          | epoll         | Tokio Runtime     | async/await        |

底层基本是一个架构：

```text
Kernel
    │
epoll
    │
Reactor（事件分发）
    │
调度器（Scheduler）
    │
你的业务代码
```

区别只在于调度器如何恢复业务逻辑：

Node.js 恢复 Callback/Promise。
Python 恢复 Coroutine。
Go 唤醒 Goroutine。
Tokio 恢复 Future。
Netty 调用 ChannelHandler。