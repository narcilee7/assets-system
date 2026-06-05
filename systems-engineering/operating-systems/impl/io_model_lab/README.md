# I/O Model Lab — Chain-1

跨语言非阻塞 Echo Server 可运行实验，展示各自语言运行时如何封装 epoll/kqueue/IOCP。

## 快速开始

```bash
# Go (Linux only, because it uses golang.org/x/sys/unix directly)
cd go
go mod init io_model_lab || true
go get golang.org/x/sys/unix
go run epoll_echo.go

# Python (Linux/macOS)
cd python
python epoll_echo.py

# Java (Linux/macOS/Windows)
cd java
javac EchoServer.java
java EchoServer

# TypeScript / Node.js
cd ts
npx tsx echo_server.ts
```

## 压测

```bash
# 需要 wrk 或 hey
./bench.sh
```

## 语言运行时映射

| 语言 | API | 底层多路复用 |
|---|---|---|
| Go | `syscall.EpollWait` (x/sys/unix) | epoll (直接调用) |
| Python | `selectors.DefaultSelector()` | epoll (Linux) / kqueue (macOS) |
| Java | `java.nio.channels.Selector` | epoll (Linux) / kqueue (macOS) / poll (fallback) |
| Node.js | `net.createServer` | libuv → epoll/kqueue/IOCP |

## 关键观察

1. **Go netpoll**：`net.Listen` 内部已经使用了非阻塞 + epoll，但通过 `x/sys/unix` 可以手动控制 ET/LT。
2. **Java NIO**：`Selector.open()` 在 Linux 上实际是 `sun.nio.ch.EPollSelectorImpl`。
3. **Node.js**：业务代码看不到 epoll，但可以通过 `process._getActiveHandles()` 观察 fd 数量。
