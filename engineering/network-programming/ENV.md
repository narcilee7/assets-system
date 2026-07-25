# 环境说明

## 依赖版本要求

| 语言 | 最低版本 | 验证命令 |
|------|----------|----------|
| Go | 1.21+ | `go version` |
| Node.js | 18+ | `node --version` |
| Python | 3.10+ | `python3 --version` |

## 额外工具（可选）

| 工具 | 用途 | 安装 |
|------|------|------|
| `curl` | 测试 HTTP 服务器 | 通常预装 |
| `nc` (netcat) | 测试 TCP/UDP 服务器 | macOS 预装；Linux: `apt install netcat-openbsd` |
| `dig` | 对比 DNS 解析结果 | `apt install dnsutils` / macOS 预装 |

## 各语言运行方式

### Go

```bash
cd <topic>/skeleton/go
go run main.go
```

Go 骨架均为单文件 `main.go`，大部分题目会**在同一进程内同时启动 server 和 client** 进行自测。

### Python

```bash
cd <topic>/skeleton/python
python3 main.py
```

Python 骨架根据题目特点选择 `socket`、`select`、`threading`、`asyncio`。

### Node.js

```bash
cd <topic>/skeleton/nodejs
node index.js
```

Node.js 骨架优先使用内置模块（`net`、`dgram`、`http`、`crypto`），不依赖外部 npm 包。

> **注意**：12-websocket 的 Node.js 版本需要你手动实现 WebSocket 握手和帧解析（基于 `http` + `crypto` 内置模块），不依赖 `ws` 库。

## 推荐训练路径

1. **同一题目，先写最熟悉的语言**，建立直觉。
2. **再写第二语言**，对比 IO 模型差异（如 Go 的 goroutine-per-connection vs Python 的 `select` vs Node.js 的 `EventEmitter`）。
3. **最后写第三语言**，加深对网络编程本质的理解。

## 端口与并发测试提示

- 骨架中 server 绑定端口 `0`（随机端口）以避免冲突，通过 `listener.Addr()` 获取实际端口传给 client。
- 如果测试出现 "address already in use"，等待几秒让 OS 回收端口，或修改代码使用随机端口。
- 部分题目需要同时运行 server 和 client，骨架已内嵌测试逻辑，无需手动开两个终端。
