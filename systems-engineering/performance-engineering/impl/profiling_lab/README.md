# Profiling Lab — Chain-1

跨语言 CPU Profiling 可运行实验。每个示例都是一个 CPU 密集的 HTTP 服务，你可以用对应的 profiler 生成火焰图。

## 快速开始

```bash
# Go
cd go
go run cpu_hog.go &
curl http://localhost:8080/work
go tool pprof -http=:8081 http://localhost:8080/debug/pprof/profile?seconds=10

# Python
cd python
pip install -r requirements.txt
./profile.sh

# Java
cd java
# 先下载 async-profiler 到当前目录
./profile.sh

# TypeScript / Node.js
cd ts
npm install
npm start &
curl http://localhost:8080/work
node --prof cpu_hog.ts
node --prof-process isolate-*.log > profile.txt
```

## 原理对照

| 语言 | Profiler | 底层机制 |
|---|---|---|
| Go | `runtime/pprof` | `SIGPROF` + `setitimer`，采样所有运行 goroutine 的栈 |
| Python | `cProfile` / `flameprof` | 解释器钩子 `_PyEval_EvalFrameDefault`，逐函数计数 |
| Java | async-profiler | `perf_event_open` + ` dwarf` / `frame pointer`，低开销 |
| Node.js | `--prof` / `0x` | V8 内置采样器，`--prof-process` 输出 tick 分布 |

## 预期输出

- 火焰图中 `fib` 或 `cpuIntensive` 会占据最宽的方块。
- 可以用来验证“CPU 热点 = 最宽叶节点”这一读图原则。
