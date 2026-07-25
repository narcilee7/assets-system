package eventbus

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
)

// Event 所有事件必须实现此接口
type Event interface {
	// Topic 返回事件主题，用于路由
	Topic() string
}

// Handler 事件处理器
type Handler func(ctx context.Context, event Event) error

// Bus 事件总线
type Bus struct {
	mu        sync.RWMutex
	handlers  map[string][]handlerEntry // topic -> handlers
	wg        sync.WaitGroup
	closed    atomic.Bool
	asyncCh   chan asyncJob
	asyncOnce sync.Once
}

type handlerEntry struct {
	name    string
	handler Handler
	async   bool // true=异步执行，false=同步执行
}

type asyncJob struct {
	ctx   context.Context
	event Event
	entry handlerEntry
}

// New 创建事件总线
// asyncWorkers: 异步处理 goroutine 数量，0 表示不启用异步
// asyncBuffer: 异步队列缓冲大小
func New(asyncWorkers int, asyncBuffer int) *Bus {
	b := &Bus{
		handlers: make(map[string][]handlerEntry),
	}
	if asyncWorkers > 0 && asyncBuffer > 0 {
		b.asyncCh = make(chan asyncJob, asyncBuffer)
		for i := 0; i < asyncWorkers; i++ {
			go b.asyncWorker()
		}
	}
	return b
}

// Subscribe 订阅事件
// name: handler 名称，用于日志和排错
// topic: 订阅的主题
// async: 是否异步执行
// handler: 处理函数
func (b *Bus) Subscribe(name, topic string, async bool, handler Handler) error {
	if b.closed.Load() {
		return errors.New("event bus is closed")
	}
	if handler == nil {
		return errors.New("handler is nil")
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	b.handlers[topic] = append(b.handlers[topic], handlerEntry{
		name:    name,
		handler: handler,
		async:   async,
	})
	return nil
}

// Unsubscribe 移除指定名称的 handler（演示用，生产通常不卸载）
func (b *Bus) Unsubscribe(topic, name string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	entries := b.handlers[topic]
	filtered := make([]handlerEntry, 0, len(entries))
	for _, e := range entries {
		if e.name != name {
			filtered = append(filtered, e)
		}
	}
	b.handlers[topic] = filtered
}

// Publish 发布事件
// 同步 handler 在当前 goroutine 执行
// 异步 handler 投递到队列（如果队列满则丢弃并返回错误）
func (b *Bus) Publish(ctx context.Context, event Event) error {
	if b.closed.Load() {
		return errors.New("event bus is closed")
	}

	topic := event.Topic()

	b.mu.RLock()
	entries := make([]handlerEntry, len(b.handlers[topic]))
	copy(entries, b.handlers[topic])
	b.mu.RUnlock()

	if len(entries) == 0 {
		return nil // 无人订阅，静默成功
	}

	var errs []error

	for _, entry := range entries {
		if entry.async {
			// 异步：投递到队列
			if b.asyncCh == nil {
				errs = append(errs, fmt.Errorf("async not enabled for handler %q", entry.name))
				continue
			}
			select {
			case b.asyncCh <- asyncJob{ctx: ctx, event: event, entry: entry}:
				// 投递成功
			case <-ctx.Done():
				errs = append(errs, fmt.Errorf("context cancelled before dispatch to %q: %w", entry.name, ctx.Err()))
			default:
				errs = append(errs, fmt.Errorf("async queue full, dropped event for %q", entry.name))
			}
		} else {
			// 同步：直接执行，单个失败不影响其他
			if err := entry.handler(ctx, event); err != nil {
				errs = append(errs, fmt.Errorf("handler %q failed: %w", entry.name, err))
			}
		}
	}

	if len(errs) > 0 {
		// 聚合错误返回，不吞单个错误
		return &PublishError{Topic: topic, Errors: errs}
	}
	return nil
}

// PublishSync 只执行同步 handler，忽略异步 handler（用于需要等结果的场景）
func (b *Bus) PublishSync(ctx context.Context, event Event) error {
	if b.closed.Load() {
		return errors.New("event bus is closed")
	}

	topic := event.Topic()

	b.mu.RLock()
	entries := make([]handlerEntry, len(b.handlers[topic]))
	copy(entries, b.handlers[topic])
	b.mu.RUnlock()

	var errs []error
	for _, entry := range entries {
		if entry.async {
			continue // 跳过异步
		}
		if err := entry.handler(ctx, event); err != nil {
			errs = append(errs, fmt.Errorf("handler %q failed: %w", entry.name, err))
		}
	}

	if len(errs) > 0 {
		return &PublishError{Topic: topic, Errors: errs}
	}
	return nil
}

// Close 优雅关闭
// 停止接收新事件，等待所有异步 handler 完成
func (b *Bus) Close() error {
	if !b.closed.CompareAndSwap(false, true) {
		return errors.New("already closed")
	}

	if b.asyncCh != nil {
		close(b.asyncCh)
		b.wg.Wait()
	}
	return nil
}

// asyncWorker 异步处理 goroutine
func (b *Bus) asyncWorker() {
	for job := range b.asyncCh {
		// 每个 job 独立 WaitGroup
		b.wg.Add(1)
		go func(j asyncJob) {
			defer b.wg.Done()
			// 异步 handler 的错误只打日志，不返回
			if err := j.entry.handler(j.ctx, j.event); err != nil {
				// 实际生产里这里接入日志系统
				_ = fmt.Errorf("async handler %q failed: %w", j.entry.name, err)
			}
		}(job)
	}
}

// ============ 错误类型 ============

// PublishError 发布时的聚合错误
type PublishError struct {
	Topic  string
	Errors []error
}

func (e *PublishError) Error() string {
	return fmt.Sprintf("eventbus publish to %q: %d handler(s) failed", e.Topic, len(e.Errors))
}

// Unwrap 支持 errors.Is 遍历
func (e *PublishError) Unwrap() []error {
	return e.Errors
}