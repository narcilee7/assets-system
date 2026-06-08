package main

import (
	"errors"
	"fmt"
)

// Task 是一个可执行的任务。
type Task func() (int, error)

// Result 是任务执行结果。
type Result struct {
	Value int
	Err   error
}

// WorkerPool 固定大小的 goroutine 池。
// TODO: 添加任务队列 channel、结果 channel、worker 数量、关闭状态、WaitGroup 等。
type WorkerPool struct {
	// TODO
}

// NewWorkerPool 创建 worker pool。
func NewWorkerPool(workerCount int) *WorkerPool {
	// TODO: 初始化并启动 workerCount 个 goroutine
	return &WorkerPool{}
}

// Submit 提交一个任务。如果 pool 已关闭，返回错误。
func (p *WorkerPool) Submit(task Task) error {
	// TODO: 如果已关闭返回错误；否则将任务发送到队列
	return errors.New("not implemented")
}

// Results 返回结果 channel（只读）。
func (p *WorkerPool) Results() <-chan Result {
	// TODO
	return nil
}

// Shutdown 优雅关闭：等待所有已提交任务完成，关闭结果 channel。
func (p *WorkerPool) Shutdown() {
	// TODO: 标记关闭、等待所有 worker 结束、关闭结果 channel
}

func main() {
	pool := NewWorkerPool(4)
	const numTasks = 20

	var expectedSum int64
	for i := 0; i < numTasks; i++ {
		n := i
		expectedSum += int64(n * n)
		err := pool.Submit(func() (int, error) {
			return n * n, nil
		})
		if err != nil {
			fmt.Printf("FAIL: submit error: %v\n", err)
			return
		}
	}

	pool.Shutdown()

	var actualSum int64
	for r := range pool.Results() {
		if r.Err != nil {
			fmt.Printf("FAIL: task error: %v\n", r.Err)
			return
		}
		actualSum += int64(r.Value)
	}

	if actualSum == expectedSum {
		fmt.Printf("PASS: sum = %d (expected %d)\n", actualSum, expectedSum)
	} else {
		fmt.Printf("FAIL: sum = %d (expected %d)\n", actualSum, expectedSum)
	}

	// 验证关闭后不能再提交
	err := pool.Submit(func() (int, error) { return 0, nil })
	if err == nil {
		fmt.Println("FAIL: expected error after shutdown")
	} else {
		fmt.Println("PASS: shutdown correctly rejects new tasks")
	}
}
