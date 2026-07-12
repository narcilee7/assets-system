# 06 HTTP Client（HTTP 客户端）

## 问题描述

实现一个生产级的 **HTTP 客户端**，具备以下能力：
- **超时控制**：连接超时、读取超时、总超时。
- **重试机制**：对可重试错误（网络错误、5xx）进行指数退避重试。
- **取消支持**：支持主动取消正在进行的请求。
- **幂等判断**：只对幂等方法（GET/HEAD/PUT/DELETE/OPTIONS）自动重试，POST 默认不重试。

## 核心概念

- **超时分层**：连接超时（TCP 握手）、读取超时（等响应）、总超时（整个请求生命周期）。
- **指数退避（Exponential Backoff）**：`base * 2^attempt + jitter`，避免惊群效应。
- **幂等性（Idempotency）**：多次执行结果相同。GET 是幂等的，POST 不是（可能创建多条记录）。
- **取消传播**：取消信号应中断底层 socket 的阻塞操作。

## 约束

- 不得使用语言内置的 HTTP 客户端库（如 Go 的 `net/http.Client`、Python 的 `urllib`/`requests`、Node.js 的 `http.request`）。
- 必须基于原始 TCP socket 发送 HTTP 请求并解析响应。

## 手写提示

1. 重试前是否需要关闭旧连接、创建新连接？
2. 指数退避的 jitter 怎么加？（随机化避免所有客户端同时重试）
3. 如何区分可重试错误和不可重试错误？（连接超时 vs 证书错误）
4. 取消信号如何中断正在进行中的 socket read？

## 验证方式

```bash
make run
```

验证逻辑：搭建模拟 server（部分请求失败），验证客户端正确重试、超时、取消。
