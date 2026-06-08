# 05 Pub/Sub（发布订阅）

## 问题描述

实现一个事件发布订阅系统 `EventEmitter`，支持：
- 订阅指定事件
- 发布事件并传递数据
- 取消订阅
- 一次性订阅（订阅后自动取消）

## 核心概念

- **发布订阅模式（Publish/Subscribe）**：解耦事件发送者和接收者。
- **事件命名空间**：支持 `click` 或 `user:login` 等命名风格。
- **once 订阅**：只执行一次，执行后自动取消。
- **error 事件**：错误传播机制。

## 约束

- 不得使用 Node.js 内置 `EventEmitter`。
- 必须支持 `once`（一次性订阅）。
- 返回的 unsubscribe 函数必须是同步的。

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证事件系统
```