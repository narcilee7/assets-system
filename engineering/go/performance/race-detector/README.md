# Go 竞态检测与并发安全

Go 的 `go test -race` 是发现数据竞态（Data Race）的利器，它基于 ThreadSanitizer 实现，能够在测试或运行时检测非同步的内存访问。数据竞态是并发程序中最隐蔽的 Bug 之一，可能导致内存损坏、逻辑错误或随机 panic。Go 的内存模型明确规定：对同一变量的并发读写中至少有一个是同步操作时，才允许无锁访问。

## 核心概念

数据竞态发生在：两个或多个 goroutine 同时访问同一内存位置，且至少一个是写操作，且没有同步机制（mutex、channel、atomic）保护。Race Detector 通过 shadow memory 技术跟踪每个内存位置的访问历史，当检测到冲突访问时立即报告堆栈信息。

Race Detector 有约 10 倍的 CPU 开销和 10 倍的内存开销，因此**不适合长期运行在生产环境**。推荐在 CI 中开启 race 测试，或在预发布环境短期运行。Go 1.22 的 `sync/atomic` 新增 `atomic.Pointer` 等类型，使得无锁数据结构更安全易用。

## 代码实现

```go
// race_example_test.go
package concurrent

import (
	"sync"
	"testing"
)

// 有竞态的代码：多个 goroutine 同时写 counter
func IncrementRace(counter *int, n int, wg *sync.WaitGroup) {
	for i := 0; i < n; i++ {
		*counter++ // 竞态！
	}
	wg.Done()
}

// 修复 1：使用 sync.Mutex
func IncrementMutex(counter *int, mu *sync.Mutex, n int, wg *sync.WaitGroup) {
	for i := 0; i < n; i++ {
		mu.Lock()
		*counter++
		mu.Unlock()
	}
	wg.Done()
}

// 修复 2：使用 sync/atomic
func IncrementAtomic(counter *int64, n int, wg *sync.WaitGroup) {
	for i := 0; i < n; i++ {
		atomic.AddInt64(counter, 1)
	}
	wg.Done()
}

// 修复 3：使用 channel（Go 哲学）
func IncrementChannel(counterChan chan int, n int, wg *sync.WaitGroup) {
	for i := 0; i < n; i++ {
		counterChan <- 1
	}
	wg.Done()
}

func TestRaceDetection(t *testing.T) {
	// 这段代码会触发 race detector 报警
	var counter int
	var wg sync.WaitGroup

	wg.Add(2)
	go IncrementRace(&counter, 1000, &wg)
	go IncrementRace(&counter, 1000, &wg)
	wg.Wait()

	t.Logf("Counter: %d", counter)
}

func TestMutexFix(t *testing.T) {
	var counter int
	var mu sync.Mutex
	var wg sync.WaitGroup

	wg.Add(2)
	go IncrementMutex(&counter, &mu, 1000, &wg)
	go IncrementMutex(&counter, &mu, 1000, &wg)
	wg.Wait()

	if counter != 2000 {
		t.Errorf("expected 2000, got %d", counter)
	}
}

func TestAtomicFix(t *testing.T) {
	var counter int64
	var wg sync.WaitGroup

	wg.Add(2)
	go IncrementAtomic(&counter, 1000, &wg)
	go IncrementAtomic(&counter, 1000, &wg)
	wg.Wait()

	if counter != 2000 {
		t.Errorf("expected 2000, got %d", counter)
	}
}
```

```go
// lock_free.go
package concurrent

import (
	"sync/atomic"
)

// LockFreeStack 无锁栈（Treiber Stack）
type LockFreeStack[T any] struct {
	top atomic.Pointer[Node[T]]
}

type Node[T any] struct {
	value T
	next  *Node[T]
}

func (s *LockFreeStack[T]) Push(value T) {
	newNode := &Node[T]{value: value}
	for {
		oldTop := s.top.Load()
		newNode.next = oldTop
		if s.top.CompareAndSwap(oldTop, newNode) {
			return
		}
	}
}

func (s *LockFreeStack[T]) Pop() (T, bool) {
	for {
		oldTop := s.top.Load()
		if oldTop == nil {
			var zero T
			return zero, false
		}
		newTop := oldTop.next
		if s.top.CompareAndSwap(oldTop, newTop) {
			return oldTop.value, true
		}
	}
}

// AtomicConfig 使用 atomic.Pointer 管理配置热更新
type AtomicConfig struct {
	ptr atomic.Pointer[Config]
}

type Config struct {
	MaxConnections int
	TimeoutMs      int
	FeatureFlags   map[string]bool
}

func (ac *AtomicConfig) Load() *Config {
	return ac.ptr.Load()
}

func (ac *AtomicConfig) Store(c *Config) {
	ac.ptr.Store(c)
}
```

```go
// rwmutex_example.go
package concurrent

import (
	"sync"
	"time"
)

// Cache 使用 RWMutex 实现高并发读缓存
type Cache struct {
	mu    sync.RWMutex
	items map[string]interface{}
}

func NewCache() *Cache {
	return &Cache{items: make(map[string]interface{})}
}

func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	val, ok := c.items[key]
	return val, ok
}

func (c *Cache) Set(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = value
}

// 注意：不要返回内部对象的引用，否则 RLock 保护失效
func (c *Cache) GetUnsafe(key string) *Config {
	c.mu.RLock()
	defer c.mu.RUnlock()
	// 危险：返回指针后 RLock 已释放，其他 goroutine 可能修改
	return c.items[key].(*Config)
}

// 正确做法：返回拷贝
func (c *Cache) GetSafe(key string) (Config, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	val, ok := c.items[key]
	if !ok {
		return Config{}, false
	}
	// 深拷贝
	original := val.(*Config)
	copyCfg := *original
	copyCfg.FeatureFlags = make(map[string]bool)
	for k, v := range original.FeatureFlags {
		copyCfg.FeatureFlags[k] = v
	}
	return copyCfg, true
}
```

```bash
# === Race Detector 使用 ===

# 测试时开启
go test -race ./...

# 运行时开启
go run -race main.go

# 构建时开启（不推荐使用，性能差）
go build -race -o app .

# 设置竞态检测历史大小（默认 1）
GORACE="history_size=7" go test -race ./...

# 忽略特定竞态（仅调试用，不要用于生产）
GORACE="suppress=suppressions.txt" go test -race ./...
```

## 选型对比

| 同步原语 | 适用场景 | 性能 | 复杂度 |
| --- | --- | --- | --- |
| `sync.Mutex` | 通用互斥 | 中 | 低 |
| `sync.RWMutex` | 读多写少 | 读极高，写中 | 低 |
| `sync/atomic` | 计数器、标志位、指针 | 极高 | 中 |
| `channel` | goroutine 协调、数据传递 | 高 | 中 |
| `sync.Map` | 频繁读写的并发 map | 读极高 | 低 |
| `atomic.Pointer` | 配置热更新、无锁数据结构 | 极高 | 高 |

## 最佳实践

- **CI 必开 Race**：所有并发相关代码的 CI Pipeline 必须运行 `go test -race`
- **最小临界区**：Mutex 保护的代码越少越好，避免在锁内做 IO
- **不要复制 Mutex**：`sync.Mutex` 是值类型，复制后会失效，结构体传指针
- **RWMutex 陷阱**：返回内部引用会破坏读保护，必须返回深拷贝
- **Atomic 顺序**：`atomic` 保证原子性但不保证顺序性，配合 `runtime/memory` fence 使用
- **Channel 所有权**：发送方拥有 channel，接收方只读；关闭权属于发送方
- **避免共享**：Go 箴言 "Do not communicate by sharing memory; instead, share memory by communicating"
