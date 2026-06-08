# Goroutine & Channel

Go 的并发哲学：不用共享内存来通信，而用通信来共享内存。

## 核心实现

### 1. Goroutine 基础

```go
// goroutine_basic.go
package main

import (
	"fmt"
	"sync"
	"time"
)

func sayHello(wg *sync.WaitGroup) {
	defer wg.Done()
	fmt.Println("Hello from goroutine")
}

func main() {
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go sayHello(&wg)
	}
	wg.Wait()
}
```

### 2. Channel 模式

```go
// channel_patterns.go
package main

import "fmt"

// 1. 基本通信
func basicChannel() {
	ch := make(chan string)
	go func() {
		ch <- "hello"
	}()
	msg := <-ch
	fmt.Println(msg)
}

// 2. Buffered Channel
func bufferedChannel() {
	ch := make(chan int, 3)
	ch <- 1
	ch <- 2
	ch <- 3
	close(ch)
	for v := range ch {
		fmt.Println(v)
	}
}

// 3. Fan-Out / Fan-In
func fanOutFanIn() {
	jobs := make(chan int, 10)
	results := make(chan int, 10)

	// 3 workers
	for w := 1; w <= 3; w++ {
		go func(id int) {
			for job := range jobs {
				results <- job * 2
			}
		}(w)
	}

	// Send jobs
	for j := 1; j <= 5; j++ {
		jobs <- j
	}
	close(jobs)

	// Collect results
	for i := 0; i < 5; i++ {
		fmt.Println(<-results)
	}
}

// 4. Select 多路复用
func selectPattern() {
	ch1 := make(chan string)
	ch2 := make(chan string)

	go func() { ch1 <- "from ch1" }()
	go func() { ch2 <- "from ch2" }()

	for i := 0; i < 2; i++ {
		select {
		case msg1 := <-ch1:
			fmt.Println(msg1)
		case msg2 := <-ch2:
			fmt.Println(msg2)
		}
	}
}

// 5. Timeout Pattern
func withTimeout() {
	ch := make(chan string)
	go func() {
		time.Sleep(2 * time.Second)
		ch <- "result"
	}()

	select {
	case res := <-ch:
		fmt.Println(res)
	case <-time.After(1 * time.Second):
		fmt.Println("timeout")
	}
}

// 6. Done Channel (取消信号)
func withCancel(done <-chan struct{}) {
	for {
		select {
		case <-done:
			fmt.Println("Cancelled")
			return
		default:
			fmt.Println("Working...")
			time.Sleep(100 * time.Millisecond)
		}
	}
}
```

## Goroutine vs Thread vs Node.js Worker

| 维度 | Go Goroutine | OS Thread | Node.js Worker Thread |
| --- | --- | --- | --- |
| 内存占用 | ~2KB 栈 | ~1MB | ~几MB |
| 切换成本 | 用户态，极快 | 内核态，慢 | 内核态，慢 |
| 创建成本 | 极快 | 慢 | 慢 |
| 调度 | Go Runtime (GMP) | OS 内核 | OS 内核 |
| 通信 | Channel | 共享内存+锁 | MessagePort |
| 数量 | 百万级 | 千级 | 百级 |

## 常见陷阱

- 向 nil channel 发送/接收会永远阻塞。
- 向已关闭 channel 发送会 panic。
- 重复关闭 channel 会 panic。
- 忘记 `close(channel)` 可能导致 goroutine 泄漏。
- `range channel` 在 channel 关闭后自动退出。
