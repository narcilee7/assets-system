# 环境说明

## 依赖版本要求

| 语言 | 最低版本 | 验证命令 |
|------|----------|----------|
| Go | 1.21+ | `go version` |
| Node.js | 18+ | `node --version` |
| Python | 3.10+ | `python3 --version` |

## 快速检查

```bash
cd engineering/concurrency
make check-env    # 检查全局环境（若存在顶层 Makefile）
```

## 各语言运行方式

### Go

```bash
cd <topic>/skeleton/go
go run main.go
```

每个 Go 骨架均为单文件 `main.go`，可直接运行。需要补充的代码块用 `// TODO:` 标出。

### Python

```bash
cd <topic>/skeleton/python
python3 main.py
```

Python 骨架根据题目特点选择 `threading`、`asyncio` 或 `multiprocessing`。文件顶部有注释说明当前使用的并发模型。

### Node.js

```bash
cd <topic>/skeleton/nodejs
node index.js
```

Node.js 骨架分两类：
- **异步并发**：使用原生 `Promise` / `async/await`，无需额外依赖。
- **真并行**：使用 `worker_threads` 模块（Node.js 内置），无需安装包。

## 推荐训练路径

1. **同一题目，先写最熟悉的语言**，建立直觉。
2. **再写第二语言**，对比 API 差异（如 Go 的 channel vs Python 的 queue vs Node.js 的 EventEmitter）。
3. **最后写第三语言**，加深对并发模型本质的理解。

## 手写建议

- 准备纸质笔记本，先画出**状态图**或**时序图**，再写代码。
- 不要直接看 `solution/`（若后续补充），先让自己的实现通过 `make test`。
- 记录踩坑点：死锁、竞态、忘记释放锁、goroutine/线程泄漏等。
