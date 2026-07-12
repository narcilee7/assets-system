# 12 WebSocket（WebSocket 服务器）

## 问题描述

实现一个简化版的 **WebSocket 服务器**：
- 完成 HTTP **Upgrade 握手**：解析客户端的 Sec-WebSocket-Key，生成 Sec-WebSocket-Accept（base64(sha1(key + GUID))）。
- 解析 **WebSocket 帧**：解析 FIN、opcode、mask、payload length、masking key、payload data。
- 处理 **文本帧**（opcode=0x1）和 **关闭帧**（opcode=0x8）。
- 对收到的文本帧，回复一个** pong 帧**（opcode=0xA）或回显文本帧。

## 核心概念

- **Upgrade 握手**：HTTP/1.1 101 Switching Protocols，通过 Sec-WebSocket-Key/Accept 验证。
- **帧协议**：WebSocket 数据在 TCP 之上以帧为单位传输，每帧包含控制信息和 payload。
- **Masking**：客户端发送的帧必须 mask，服务器发送的帧不 mask。

## 约束

- **Node.js**：不得使用 `ws` 等外部库，必须基于 `http` + `crypto` 内置模块手动实现握手和帧解析。
- Go 和 Python 同样不得使用现成 WebSocket 库。

## 手写提示

1. Sec-WebSocket-Accept 的 GUID 是什么？（`258EAFA5-E914-47DA-95CA-C5AB0DC85B11`）
2. 帧头的前 2 个字节分别是什么？（FIN+RSV+opcode, MASK+payload length）
3. payload length 可能是 7bit、16bit 或 64bit，如何判断？
4. masking key 怎么用来解码 payload？（每 4 字节 XOR 循环）

## 验证方式

```bash
make run
```

验证逻辑：使用浏览器 WebSocket API 或脚本连接服务器，发送文本消息，验证收到回复。
