# Network Engineering

网络工程训练体系 —— 从 Socket 原语到分布式通信模式。

## 训练哲学

1. **先手写，后对照**：每个题目只提供骨架代码（skeleton），核心逻辑处标有 `TODO`。先尝试独立完成，再查阅参考实现。
2. **多语言视角**：同一问题用 Go（标准库极简）、Node.js（事件驱动）、Python（同步+异步）分别实现，理解不同 IO 模型的取舍。
3. **可验证**：每个题目附带 `Makefile` 和自测用例，写完即可运行验证。

## 体系索引

### 第一阶段：Socket 基础（Socket Fundamentals）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 01 | [tcp-echo](01-tcp-echo/) | TCP Socket、Listen/Accept、Dial | ✅ | ✅ | ✅ |
| 02 | [udp-server](02-udp-server/) | UDP Socket、无连接、数据报 | ✅ | ✅ | ✅ |

### 第二阶段：IO 模型（IO Models）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 03 | [io-multiplexing](03-io-multiplexing/) | Select/Poll、单线程多连接 | ✅ | ✅ | ✅ |
| 04 | [nonblocking-io](04-nonblocking-io/) | 非阻塞 Socket、事件循环 | ✅ | ✅ | ✅ |

### 第三阶段：HTTP 与协议（HTTP & Protocols）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 05 | [http-server](05-http-server/) | HTTP/1.1、Keep-Alive、Pipeline | ✅ | ✅ | ✅ |
| 06 | [http-client](06-http-client/) | 超时、重试、取消、幂等 | ✅ | ✅ | ✅ |
| 07 | [dns-resolver](07-dns-resolver/) | DNS 协议、UDP 查询、解析 | ✅ | ✅ | ✅ |

### 第四阶段：网络模式（Network Patterns）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 08 | [connection-pool](08-connection-pool/) | 连接复用、最大连接数、超时驱逐 | ✅ | ✅ | ✅ |
| 09 | [proxy](09-proxy/) | TCP 反向代理、透明转发 | ✅ | ✅ | ✅ |
| 10 | [load-balancer](10-load-balancer/) | 负载均衡、Round Robin、健康检查 | ✅ | ✅ | ✅ |

### 第五阶段：实时通信（Real-time Communication）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 11 | [chat-server](11-chat-server/) | 广播、私聊、在线列表、连接管理 | ✅ | ✅ | ✅ |
| 12 | [websocket](12-websocket/) | WebSocket 握手、帧解析、心跳 | ✅ | ✅ | ✅ |
| 13 | [sse](13-sse/) | Server-Sent Events、断线重连、Last-Event-ID | ✅ | ✅ | ✅ |

### 第六阶段：可靠传输（Reliable Transport）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 14 | [reliable-udp](14-reliable-udp/) | 序列号、ACK、超时重传、滑动窗口 | ✅ | ✅ | ✅ |

## 追问清单（训练后自测）

- 你的 server 能处理多少并发连接？瓶颈在哪里？
- 如果客户端异常断开（没有发 FIN），server 多久能感知？
- 重试时如何区分可重试错误和不可重试错误？
- 上传大文件时，内存占用如何控制？
- 负载均衡器如何做健康检查？频率多高？失败几次才摘除？
- WebSocket 断线后，如何恢复状态？（Last-Event-ID / 会话存储）
- UDP 可靠传输的 ACK 机制，如果 ACK 本身丢了怎么办？

## 快速开始

```bash
cd engineering/network/01-tcp-echo
# 阅读题目
make run      # 运行当前骨架（预期会失败或连接不上）
# 打开 skeleton/ 下的目标语言文件，补全 TODO
make test     # 验证你的实现
```

更多环境细节见 [ENV.md](ENV.md)。
