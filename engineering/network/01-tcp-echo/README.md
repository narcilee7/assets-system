# 01 TCP Echo（TCP 回声服务器）

## 问题描述

实现一个 **TCP Echo Server**：
- 监听一个 TCP 端口，接受客户端连接。
- 将客户端发送的每一行数据原样返回（echo）。
- 客户端发送 `quit` 时，关闭连接。

同时实现配套的 **TCP Echo Client**：
- 连接服务器，发送若干消息。
- 验证返回内容与发送内容一致。

## 核心概念

- **Socket 生命周期**：`socket → bind → listen → accept → read/write → close`
- **面向连接**：TCP 提供可靠字节流，但需要处理粘包/半包（本题用换行符作为分隔）。

## 约束

- 必须显式使用底层 Socket API（Go 的 `net`、Python 的 `socket`、Node.js 的 `net`），不得使用框架封装。
- Server 需要能处理多个并发连接（每个连接一个 goroutine / 线程 / callback）。

## 手写提示

1. 如何处理客户端异常断开（没有发 `quit`，直接断网）？
2. `read` 返回 0 字节意味着什么？
3. Server 如何优雅关闭？（停止 accept，等待现有连接处理完毕）

## 验证方式

```bash
make run
```

验证逻辑：同一进程内启动 server，client 连接并发送 `hello`、`world`、`quit`，验证返回内容正确。
