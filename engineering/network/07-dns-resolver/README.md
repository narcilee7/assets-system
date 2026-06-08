# 07 DNS Resolver（DNS 解析器）

## 问题描述

实现一个简化版的 **DNS 解析器**：
- 向指定的 DNS 服务器（如 `8.8.8.8:53`）发送 UDP DNS 查询请求。
- 解析 DNS 响应报文，提取 A 记录（IPv4 地址）。
- 支持查询任意域名（如 `example.com`）。

## 核心概念

- **DNS 协议**：基于 UDP 端口 53，请求和响应使用相同的报文格式（Header + Question + Answer）。
- **报文格式**：12 字节 Header（包含 Transaction ID、Flags、计数器），后接 Question 和 Answer Section。
- **编码**：域名使用长度前缀标签编码（如 `example.com` -> `7example3com0`）。

## 约束

- 不得使用语言内置的 DNS 解析函数（如 Go 的 `net.ResolveTCPAddr`、Python 的 `socket.gethostbyname`、Node.js 的 `dns.lookup`）。
- 必须手动构造 DNS 查询报文并解析响应报文。

## 手写提示

1. DNS Header 的 12 个字节分别是什么含义？（Transaction ID、Flags、QDcount、ANcount、NScount、ARcount）
2. 域名如何编码？（标签长度 + 标签内容，以 0 结尾）
3. A 记录的 RData 是什么格式？（4 字节 IPv4 地址）
4. 如果 DNS 服务器没有返回 A 记录怎么办？

## 验证方式

```bash
make run
```

验证逻辑：查询 `example.com` 的 A 记录，验证返回的是合法的 IPv4 地址格式。
