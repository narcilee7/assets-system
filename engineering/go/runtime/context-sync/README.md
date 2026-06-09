# Context & Sync Primitives

Context 是 Go 并发编程的标配，用于传递截止时间、取消信号和请求元数据。

## Context 核心用法

```go
// context_patterns.go
package main

import (
	"context"
	"fmt"
	"time"
)

// 1. 超时控制
func withTimeout(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	select {
	case <-time.After(3 * time.Second):
		return "done", nil
	case <-ctx.Done():
		return "", ctx.Err() // context deadline exceeded
	}
}

// 2. 取消传播
func withCancel(parent context.Context) {
	ctx, cancel := context.WithCancel(parent)
	defer cancel()

	go func() {
		time.Sleep(1 * time.Second)
		cancel() // 取消所有子 context
	}()

	select {
	case <-ctx.Done():
		fmt.Println("cancelled:", ctx.Err())
	}
}

// 3. 传递元数据
func withValue() {
	ctx := context.WithValue(context.Background(), "user_id", "123")
	userID := ctx.Value("user_id").(string)
	fmt.Println(userID)
}

// 4. HTTP 请求链路传递
func handleRequest(ctx context.Context) {
	reqCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// 数据库查询自动超时
	// db.QueryContext(reqCtx, "SELECT ...")
	// HTTP 请求自动超时
	// http.NewRequestWithContext(reqCtx, ...)
}
```

## Sync 原语

```go
// sync_primitives.go
package main

import (
	"sync"
	"sync/atomic"
)

// 1. Mutex / RWMutex
func mutexExample() {
	var mu sync.Mutex
	var count int

	mu.Lock()
	count++
	mu.Unlock()
}

// 2. WaitGroup
func waitGroupExample() {
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// work
		}()
	}
	wg.Wait()
}

// 3. Once
func onceExample() {
	var once sync.Once
	var config string

	loadConfig := func() {
		config = "loaded"
	}

	for i := 0; i < 10; i++ {
		go once.Do(loadConfig)
	}
}

// 4. Pool
func poolExample() {
	var bufferPool = sync.Pool{
		New: func() interface{} {
			return make([]byte, 1024)
		},
	}

	buf := bufferPool.Get().([]byte)
	// use buf
	bufferPool.Put(buf)
}

// 5. Atomic
func atomicExample() {
	var counter int64
	atomic.AddInt64(&counter, 1)
}

// 6. ErrGroup（golang.org/x/sync/errgroup）
import "golang.org/x/sync/errgroup"

func errGroupExample() {
	var g errgroup.Group
	urls := []string{"http://a.com", "http://b.com"}

	for _, url := range urls {
		g.Go(func() error {
			// fetch url
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		// handle error
	}
}
```

## Context 最佳实践

- **Context 是请求级别的**：不要存储在 struct 中作为字段（除了需要向下传递的接口），应该作为函数的第一个参数。
- **不要传 nil context**：不确定时用 `context.Background()`。
- **及时 cancel**：创建带 cancel 的 context 后，确保 `defer cancel()`。
- **只传元数据，不传控制数据**：Value 只用于请求 ID、trace ID 等，不要用于可选参数。
