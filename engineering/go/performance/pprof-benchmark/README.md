# Go 性能分析：pprof 与 Benchmark

Go 内置了业界领先的性能分析工具链：`testing` 包的 Benchmark 用于测量代码性能，`net/http/pprof` 包用于运行时 CPU/内存/阻塞分析，`go test -bench` 和 `go tool pprof` 命令提供了完整的性能调优工作流。与 Python 的 cProfile 相比，Go 的 pprof 开销极低，可以在生产环境安全采样。

## 核心概念

Go 的性能分析基于采样（Sampling）而非插桩（Instrumentation），这意味着对程序性能影响很小。CPU Profile 通过 SIGPROF 信号定期中断程序，记录当前调用栈；Heap Profile 在内存分配时采样；Goroutine Profile 导出所有 goroutine 的堆栈；Block Profile 记录 chan/mutex 阻塞事件。

Benchmark 使用 `testing.B` 提供循环计数（`b.N`）、内存分配统计（`b.ReportAllocs`）和并行测试（`b.RunParallel`）。Go 的基准测试会自动调整 `b.N` 直到获得稳定的测量结果，通常运行 1 秒或达到目标精度。

## 代码实现

```go
// benchmark_test.go
package algo

import (
	"math/rand"
	"sort"
	"testing"
	"time"
)

// SumSlice 求和实现
func SumSlice(nums []int) int {
	sum := 0
	for _, n := range nums {
		sum += n
	}
	return sum
}

// BenchmarkSumSlice 基础基准测试
func BenchmarkSumSlice(b *testing.B) {
	nums := make([]int, 10000)
	for i := range nums {
		nums[i] = i
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		SumSlice(nums)
	}
}

// BenchmarkSumSliceAlloc 报告内存分配
func BenchmarkSumSliceAlloc(b *testing.B) {
	nums := make([]int, 10000)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		SumSlice(nums)
	}
}

// BenchmarkSort 比较不同排序输入规模
func BenchmarkSort(b *testing.B) {
	sizes := []int{100, 1000, 10000}
	for _, size := range sizes {
		b.Run(fmt.Sprintf("size_%d", size), func(b *testing.B) {
			data := make([]int, size)
			for i := 0; i < b.N; i++ {
				b.StopTimer()
				for j := range data {
					data[j] = rand.Intn(size)
				}
				b.StartTimer()
				sort.Ints(data)
			}
		})
	}
}

// BenchmarkParallel 并行基准测试
func BenchmarkMapReadParallel(b *testing.B) {
	m := make(map[int]int)
	for i := 0; i < 1000; i++ {
		m[i] = i
	}

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = m[rand.Intn(1000)]
		}
	})
}
```

```go
// pprof_server.go
package main

import (
	"log"
	"net/http"
	_ "net/http/pprof" // 自动注册 /debug/pprof 路由
	"runtime"
)

func main() {
	// 设置采样率
	runtime.SetBlockProfileRate(1)     // 阻塞分析采样率
	runtime.SetMutexProfileFraction(1) // mutex 竞争采样

	go func() {
		log.Println(http.ListenAndServe("localhost:6060", nil))
	}()

	// 业务服务
	runServer()
}
```

```go
// profiling_manual.go
package main

import (
	"os"
	"runtime/pprof"
	"time"
)

func main() {
	// CPU Profile
	f, _ := os.Create("cpu.prof")
	pprof.StartCPUProfile(f)
	defer pprof.StopCPUProfile()

	// 执行要分析的业务逻辑
	processHeavyTask()

	// Heap Profile
	hf, _ := os.Create("heap.prof")
	defer hf.Close()
	pprof.WriteHeapProfile(hf)
}

func processHeavyTask() {
	for i := 0; i < 1000000; i++ {
		_ = make([]byte, 1024)
	}
	time.Sleep(time.Second)
}
```

```bash
# === 常用 pprof 命令 ===

# 运行基准测试并生成 profile
go test -bench=. -benchmem -cpuprofile=cpu.out -memprofile=mem.out

# 交互式分析 CPU
go tool pprof cpu.out
(pprof) top10          # 耗时最多的 10 个函数
(pprof) list MyFunc    # 查看函数内部热点
(pprof) web            # 生成调用图（需 graphviz）
(pprof) png > out.png  # 导出图片

# HTTP 实时采集
curl http://localhost:6060/debug/pprof/profile?seconds=30 > cpu.prof
curl http://localhost:6060/debug/pprof/heap > heap.prof
curl http://localhost:6060/debug/pprof/goroutine?debug=1 > goroutine.txt
curl http://localhost:6060/debug/pprof/block > block.prof
curl http://localhost:6060/debug/pprof/mutex > mutex.prof

# 对比两次 profile
go tool pprof -diff_base=base.prof current.prof

# 火焰图（需安装 go-torch 或 pprof 内置）
go tool pprof -http=:8080 cpu.out
```

```go
// optimization_example.go
package main

import (
	"bytes"
	"strings"
	"sync"
)

// 优化前：大量字符串拼接
func ConcatStringsSlow(items []string) string {
	result := ""
	for _, s := range items {
		result += s + ","
	}
	return result
}

// 优化后：strings.Builder
func ConcatStringsFast(items []string) string {
	var b strings.Builder
	// 预分配容量减少 realloc
	totalLen := 0
	for _, s := range items {
		totalLen += len(s) + 1
	}
	b.Grow(totalLen)

	for _, s := range items {
		b.WriteString(s)
		b.WriteByte(',')
	}
	return b.String()
}

// 优化前：频繁分配小对象
func ProcessItemsSlow(n int) []byte {
	var result []byte
	for i := 0; i < n; i++ {
		result = append(result, byte(i))
	}
	return result
}

// 优化后：预分配切片容量
func ProcessItemsFast(n int) []byte {
	result := make([]byte, 0, n)
	for i := 0; i < n; i++ {
		result = append(result, byte(i))
	}
	return result
}

// sync.Pool 复用对象减少 GC
var bufferPool = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	},
}

func UsePool() *bytes.Buffer {
	buf := bufferPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer bufferPool.Put(buf)
	// use buf...
	return buf
}
```

## 选型对比

| 工具 | 分析维度 | 开销 | 生产可用 | 可视化 |
| --- | --- | --- | --- | --- |
| net/http/pprof | CPU/Heap/Goroutine/Block/Mutex | 低 | ✅ | Web UI + flamegraph |
| go test -bench | 函数吞吐量 | 无 | ✅ | benchstat |
| trace | 调度/阻塞/系统调用 | 高 | 短时段 | Go Trace Viewer |
| fgprof | On-CPU + Off-CPU | 低 | ✅ | flamegraph |
| expvar | 自定义指标 | 无 | ✅ | JSON 端点 |

## 最佳实践

- **基准测试前置**：任何性能优化前写 Benchmark，用 `benchstat` 验证提升
- **避免微基准陷阱**：`b.N` 要足够大，消除系统噪音；注意 CPU 缓存影响
- **生产采样**：CPU Profile 采集 30 秒，Heap Profile 在内存告警时触发
- **火焰图分析**：关注宽度（总耗时）而非高度（调用深度），找到 fat node
- **逃逸分析**：`go build -gcflags='-m'` 查看变量逃逸到堆的情况，减少分配
- **Slice 预分配**：`make([]T, 0, capacity)` 是最常见的优化手段
- **对象池**：高频创建销毁的对象使用 `sync.Pool`，注意 Reset 清除状态
