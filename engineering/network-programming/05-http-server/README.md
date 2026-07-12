# 05 HTTP Server（HTTP 服务器）

## 问题描述

实现一个极简的 **HTTP/1.1 服务器**：
- 支持 `GET` 和 `POST` 方法。
- 能解析 Request Line、Headers 和 Body（`Content-Length` 方式）。
- 对 `GET /hello` 返回 `200 OK` + `"Hello, World!"`。
- 对 `POST /echo` 返回 `200 OK` + 请求体内容。
- 对未知路径返回 `404 Not Found`。
- 支持 **Keep-Alive**：同一个 TCP 连接可处理多个 HTTP 请求。

## 核心概念

- **HTTP 是文本协议**：请求和响应由起始行、头部、空行、正文组成。
- **持久连接**：HTTP/1.1 默认 Keep-Alive，需要正确解析请求边界（`Content-Length` 或 `Transfer-Encoding: chunked`，本题只要求 `Content-Length`）。
- **连接复用**：一个 TCP 连接上串行处理多个请求，减少三次握手开销。

## 约束

- 不得使用语言内置的 HTTP 框架（如 Go 的 `net/http`、Python 的 `http.server`、Node.js 的 `http` 模块）。
- 必须基于原始 TCP socket 逐字节解析 HTTP 请求。

## 手写提示

1. 如何确定一个 HTTP 请求读取完毕？（先读到 `\r\n\r\n` 获取 headers，再根据 `Content-Length` 读取 body）
2. Keep-Alive 时，如何知道一个请求结束、开始读取下一个请求？
3. 如果客户端在 Keep-Alive 空闲时断开，你的 read 会返回什么？

## 验证方式

```bash
make run
```

验证逻辑：在同一进程内使用 HTTP client 发送 GET /hello 和 POST /echo，验证状态码和返回体。
