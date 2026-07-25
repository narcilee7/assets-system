package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Task func(ctx context.Context)

type JobQueue struct {
	masWorkers int
	taskChan chan Task
	wg sync.WaitGroup
	ctx context.Context
	cancel context.CancelFunc
}

func NewJobQueue(maxWorkers int, maxQueueSize int) *JobQueue {
	ctx, cancel := context.WithCancel(context.Background())

	jq := &JobQueue{
		masWorkers: maxWorkers,
		taskChan: make(chan Task, maxQueueSize),
		ctx: ctx,
		cancel: cancel,
	}

	jq.start()

	return jq
}

func (jq *JobQueue) start() {
	for i := 0; i < jq.masWorkers; i++ {
		jq.wg.Add(1)
		go func(workerID int) {
			defer jq.wg.Done()
			for task := range jq.taskChan {
				task(jq.ctx)
			}
		}(i)
	}
}

func (jq *JobQueue) Submit(task Task) bool {
	select {
	case jq.taskChan <- task:
		return true
	default:
		return false
	}
}

func (jq *JobQueue) Shutdown() {
	close(jq.taskChan)

	jq.wg.Wait()

	jq.cancel()
}

func main() {
	// 创建一个最大并发 3，队列容量 5 的任务队列
	queue := NewJobQueue(3, 5)

	// 模拟提交 10 个任务
	for i := 1; i <= 10; i++ {
		jobID := i
		task := func(ctx context.Context) {
			fmt.Printf("[Worker 执行] 任务 #%d 开始...\n", jobID)
			time.Sleep(1 * time.Second) // 模拟耗时操作
			fmt.Printf("[Worker 执行] 任务 #%d 完成\n", jobID)
		}

		success := queue.Submit(task)
		if !success {
			fmt.Printf("[拒绝服务] 队列已满，任务 #%d 被丢弃\n", jobID)
		}
	}

	// 模拟运行一段时间后关闭
	time.Sleep(3 * time.Second)
	fmt.Println("[系统通知] 正在触发优雅关闭...")
	queue.Shutdown()
	fmt.Println("[系统通知] 任务队列已安全退出。")
}