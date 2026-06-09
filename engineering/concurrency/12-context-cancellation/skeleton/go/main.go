package main

import (
	"fmt"
	"sync"
	"time"
)

// CancelContext 简化版可取消上下文。
// TODO: 添加取消 channel 和 WaitGroup（或 done channel）。
type CancelContext struct {
	// TODO
}

// NewCancelContext 创建上下文。
func NewCancelContext() *CancelContext {
	// TODO: 初始化
	return &CancelContext{}
}

// Cancel 触发取消，并等待所有子任务退出。
func (ctx *CancelContext) Cancel() {
	// TODO: 关闭取消信号，等待所有子任务结束
}

// Go 启动一个受上下文管理的 goroutine。
func (ctx *CancelContext) Go(f func(done <-chan struct{})) {
	// TODO: 增加 WaitGroup，启动 goroutine 传入 done channel
}

func main() {
	ctx := NewCancelContext()
	active := 0
	var mu sync.Mutex

	for i := 0; i < 5; i++ {
		id := i
		ctx.Go(func(done <-chan struct{}) {
			mu.Lock()
			active++
			mu.Unlock()
			defer func() {
				mu.Lock()
				active--
				mu.Unlock()
			}()

			ticker := time.NewTicker(50 * time.Millisecond)
			defer ticker.Stop()
			for {
				select {
				case <-done:
					fmt.Printf("worker %d cancelled\n", id)
					return
				case <-ticker.C:
					// working
				}
			}
		})
	}

	// 给 worker 一点时间启动
	time.Sleep(100 * time.Millisecond)
	ctx.Cancel()

	mu.Lock()
	remaining := active
	mu.Unlock()
	if remaining == 0 {
		fmt.Println("PASS: all workers exited after cancellation")
	} else {
		fmt.Printf("FAIL: %d workers still active after cancellation\n", remaining)
	}
}
