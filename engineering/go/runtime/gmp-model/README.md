# GMP 调度模型

Go 的调度器是语言最核心的设计之一。GMP = Goroutine (G) + Machine (M) + Processor (P)。

## GMP 架构

```
G (Goroutine)    M (Machine/OS Thread)    P (Processor/逻辑处理器)
   ↓                      ↓                         ↓
  协程任务          实际运行的 OS 线程           运行队列 + 资源
```

- **G**：Goroutine，包含栈、指令指针、状态等
- **M**：OS Thread，由操作系统调度
- **P**：逻辑处理器，维护本地可运行队列（local runqueue），数量默认等于 CPU 核心数

## 调度策略

1. **G 绑定 P，M 需要绑定 P 才能运行 G**
2. **Work Stealing**：当 P 的本地队列为空时，从其他 P 偷取 G
3. **Handoff**：当 G 阻塞（系统调用）时，P 与 M 分离，M 挂起，P 找新的 M 继续运行

## 观察 GMP

```go
// gmp_inspect.go
package main

import (
	"fmt"
	"runtime"
	"sync"
)

func main() {
	fmt.Println("GOMAXPROCS:", runtime.GOMAXPROCS(0))
	fmt.Println("NumCPU:", runtime.NumCPU())
	fmt.Println("NumGoroutine:", runtime.NumGoroutine())

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			fmt.Printf("Goroutine %d running\n", id)
		}(i)
	}
	wg.Wait()
}
```

## GOMAXPROCS 调优

```go
// 限制 CPU 使用（容器环境）
runtime.GOMAXPROCS(4)

// 或者使用 automaxprocs 自动适配容器限制
import _ "go.uber.org/automaxprocs"
```

## 与 Node.js Event Loop 的对比

| 维度 | Go GMP | Node.js Event Loop |
| --- | --- | --- |
| 并发模型 | M:N 协程调度 | 单线程 + 回调队列 |
| CPU 利用 | 自动利用多核 | 需 cluster/worker_threads |
| 阻塞处理 | 自动切换 G，M 复用 | 阻塞会卡住整个 loop |
| I/O 模型 | 异步 I/O + 协程 | 异步 I/O + 回调 |
| 代码风格 | 同步写法，隐式并发 | async/await，显式异步 |
| 适合 | CPU 密集 + I/O 密集 | I/O 密集 |

> Go 的 `go func()` 是启动一个轻量协程，由 runtime 自动调度到多核上。Node.js 的异步操作由 event loop 单线程调度，CPU 密集任务需手动分配 worker_threads。
