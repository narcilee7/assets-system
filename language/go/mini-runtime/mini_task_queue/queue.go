package minitask

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"
)

// ===== 任务定义 =====

// Task 队列任务
type Task struct {
	ID       string
	Topic    string
	Payload  []byte
	Attempts int // 已尝试次数
	MaxRetry int // 最大重试次数，-1 表示无限重试

	// 内部状态
	createdAt time.Time
	ack       chan struct{} // 用于 Wait 等待完成
}

func NewTask(id, topic string, payload []byte) *Task {
	return &Task{
		ID:        id,
		Topic:     topic,
		Payload:   payload,
		MaxRetry:  3,
		createdAt: time.Now(),
		ack:       make(chan struct{}),
	}
}

// Wait 阻塞等待任务执行完成（成功或最终失败）
func (t *Task) Wait(ctx context.Context) error {
	select {
	case <-t.ack:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// ===== 处理器 =====

// Handler 处理任务，返回 error 表示需要重试
type Handler func(ctx context.Context, task *Task) error

// ===== 队列 =====

// Queue 任务队列
type Queue struct {
	name       string
	handler    Handler
	workers    int
	buffer     int
	retryDelay time.Duration

	mu        sync.Mutex
	tasks     chan *Task
	retryQ    chan *Task // 重试队列（带延迟）
	deadQ     chan *Task // 死信队列
	wg        sync.WaitGroup
	closed    atomic.Bool
	logger     *slog.Logger

	// 指标
	processed atomic.Int64
	failed    atomic.Int64
	retried   atomic.Int64
	dead      atomic.Int64
}

// NewQueue 创建队列
// workers: worker goroutine 数量
// buffer: 主队列缓冲大小
func NewQueue(name string, handler Handler, workers, buffer int, logger *slog.Logger) *Queue {
	if workers <= 0 {
		workers = 1
	}
	if buffer <= 0 {
		buffer = 100
	}
	if logger == nil {
		logger = slog.Default()
	}

	q := &Queue{
		name:       name,
		handler:    handler,
		workers:    workers,
		buffer:     buffer,
		retryDelay: 2 * time.Second,
		tasks:      make(chan *Task, buffer),
		retryQ:     make(chan *Task, buffer),
		deadQ:      make(chan *Task, buffer),
		logger:     logger,
	}

	// 启动 worker
	for i := 0; i < workers; i++ {
		q.wg.Add(1)
		go q.worker(i)
	}

	// 启动重试调度器（带退避延迟）
	q.wg.Add(1)
	go q.retryDispatcher()

	return q
}

// Publish 投递任务，非阻塞；队列满返回错误
func (q *Queue) Publish(task *Task) error {
	if q.closed.Load() {
		return errors.New("queue is closed")
	}
	select {
	case q.tasks <- task:
		return nil
	default:
		return errors.New("queue is full")
	}
}

// PublishSync 投递并等待任务完成
func (q *Queue) PublishSync(ctx context.Context, task *Task) error {
	if err := q.Publish(task); err != nil {
		return err
	}
	return task.Wait(ctx)
}

// DeadLetter 消费死信队列（阻塞）
func (q *Queue) DeadLetter() <-chan *Task {
	return q.deadQ
}

// Stats 返回队列指标
func (q *Queue) Stats() (processed, failed, retried, dead int64) {
	return q.processed.Load(), q.failed.Load(), q.retried.Load(), q.dead.Load()
}

// Close 优雅关闭：停止接收新任务，等所有任务处理完
func (q *Queue) Close() error {
	if !q.closed.CompareAndSwap(false, true) {
		return errors.New("already closed")
	}
	close(q.tasks)
	q.wg.Wait()
	close(q.retryQ)
	close(q.deadQ)
	return nil
}

// ===== worker =====

func (q *Queue) worker(id int) {
	defer q.wg.Done()

	for task := range q.tasks {
		if task == nil {
			continue
		}

		q.process(task)
	}
}

func (q *Queue) process(task *Task) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 执行 handler
	err := q.handler(ctx, task)
	task.Attempts++

	if err == nil {
		// 成功 ack
		q.processed.Add(1)
		q.logger.Info("task succeeded", "task", task.ID, "topic", task.Topic, "attempts", task.Attempts)
		close(task.ack)
		return
	}

	// 失败
	q.failed.Add(1)
	q.logger.Error("task failed", "task", task.ID, "error", err, "attempts", task.Attempts)

	// 判断是否重试
	if task.MaxRetry < 0 || task.Attempts <= task.MaxRetry {
		// 退避延迟：retryDelay * attempts
		backoff := q.retryDelay * time.Duration(task.Attempts)
		if backoff > 30*time.Second {
			backoff = 30 * time.Second
		}

		q.retried.Add(1)
		q.logger.Info("task retry scheduled", "task", task.ID, "backoff", backoff)

		// 投递到重试队列，由 retryDispatcher 延迟处理
		// 用 time.AfterFunc 避免阻塞 worker
		time.AfterFunc(backoff, func() {
			select {
			case q.retryQ <- task:
			default:
				// retryQ 满，直接塞回主队列（可能丢顺序但保证不丢任务）
				select {
				case q.tasks <- task:
				default:
					q.deadQ <- task // 主队列也满，进死信
				}
			}
		})
		return
	}

	// 重试耗尽，进死信
	q.dead.Add(1)
	q.logger.Error("task dead lettered", "task", task.ID, "attempts", task.Attempts)
	select {
	case q.deadQ <- task:
	default:
		// 死信队列满，丢弃（生产环境应告警）
		q.logger.Error("dead letter queue full, task dropped", "task", task.ID)
	}
	close(task.ack)
}

// retryDispatcher 把重试队列的任务重新投递到主队列
func (q *Queue) retryDispatcher() {
	defer q.wg.Done()

	for task := range q.retryQ {
		if task == nil {
			continue
		}
		// 重新投递到主队列
		select {
		case q.tasks <- task:
		default:
			// 主队列满，再塞回 retryQ（不阻塞）
			select {
			case q.retryQ <- task:
			default:
				// 都满了，丢到死信
				select {
				case q.deadQ <- task:
				default:
					q.logger.Error("all queues full, task dropped", "task", task.ID)
				}
			}
		}
	}
}