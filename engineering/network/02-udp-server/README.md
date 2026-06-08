# 02 UDP Server（UDP 服务器）

## 问题描述

实现一个 **UDP Time Server**：
- 监听一个 UDP 端口，接收客户端的数据报。
- 将当前服务器时间以字符串形式返回给客户端。
- 如果客户端发送 `"ping"`，返回 `"pong"`。

同时实现配套的 **UDP Client**：
- 向服务器发送消息，打印回复。

## 核心概念

- **无连接**：UDP 不维护连接状态，每次发送都是独立的数据报。
- **数据报边界**：UDP 保留消息边界，一次 `recvfrom` 对应一次 `sendto`。
- **不可靠**：数据报可能丢失、重复、乱序（本题在同机测试，通常不会丢包）。

## 约束

- 必须使用 UDP Socket API，不得使用 TCP。
- Server 为单线程即可（UDP 无需 accept）。

## 手写提示

1. UDP 的 `recvfrom` 返回什么？（数据 + 发送方地址）
2. 如何回复特定客户端？（使用 `sendto` 指定地址）
3. UDP socket 的缓冲区满了会怎样？

## 验证方式

```bash
make run
```

验证逻辑：client 发送 `ping` 和 `time`，验证返回 `pong` 和合法的时间字符串。
