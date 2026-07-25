# 04 Non-blocking IO（非阻塞 IO）

## 问题描述

实现一个带有**超时控制**的 TCP 客户端：
- 使用**非阻塞 connect**：在指定超时内完成连接，超时则失败。
- 使用**非阻塞 read/write**：在指定超时内完成数据收发。
- 如果超时，应能正确关闭 socket 并返回错误。

## 核心概念

- **非阻塞模式**：Socket 操作不会阻塞调用线程，如果条件不满足立即返回 `EAGAIN` / `EWOULDBLOCK`。
- **超时控制**：网络请求必须有时限，避免永远等待。
- **可中断**：超时后应清理资源，不泄漏 fd。

## 约束

- 不得使用语言内置的带超时封装（如 Go 的 `net.DialTimeout`、Python 的 `socket.create_connection` 带 timeout）。
- 必须显式设置非阻塞标志并处理 `EAGAIN` / `select` 等待。

## 手写提示

1. 非阻塞 `connect` 的行为：立即返回 `EINPROGRESS`，需要用 `select` / `poll` 等待可写。
2. 非阻塞 `read`：如果没有数据，返回 `EAGAIN`，需要等待可读事件。
3. 如何判断 `connect` 真正成功？（`getsockopt(SO_ERROR)`）

## 验证方式

```bash
make run
```

验证逻辑：连接本地 server，验证正常通信；连接一个不可达端口，验证超时返回错误。
