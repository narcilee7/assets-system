package minischeduler

import (
	"container/heap"
	"context"
	"fmt"
	"sync"
	"time"
)

// Task 调度任务
type Task struct {
	ID       string
	Next     time.Time      // 下次执行时间
	Interval time.Duration  // 0=一次性, >0=周期
	Fn       func(ctx context.Context)

	ctx    context.Context    // 任务级 context
	cancel context.CancelFunc // 取消函数
	index  int              // 在堆中的索引，支持 O(log n) 删除
}

// ===== 最小堆 =====

type taskHeap []*Task

func (h taskHeap) Len() int { return len(h) }
func (h taskHeap) Less(i, j int) bool { return h[i].Next.Before(h[j].Next) }
func (h taskHeap) Swap(i, j int) {
	h[i], h[j] = h[j], h[i]
	h[i].index = i
	h[j].index = j
}

func (h *taskHeap) Push(x interface{}) {
	n := len(*h)
	t := x.(*Task)
	t.index = n
	*h = append(*h, t)
}

func (h *taskHeap) Pop() interface{} {
	old := *h
	n := len(old)
	t := old[n-1]
	old[n-1] = nil // 避免内存泄漏
	t.index = -1
	*h = old[:n-1]
	return t
}

// ===== Scheduler =====

type Scheduler struct {
	mu       sync.Mutex
	heap     taskHeap
	tasks    map[string]*Task // ID -> Task，快速查找
	addCh    chan *Task
	cancelCh chan string
	stopCh   chan struct{}
	doneCh   chan struct{}
	wg       sync.WaitGroup
}

func New() *Scheduler {
	s := &Scheduler{
		heap:     make(taskHeap, 0),
		tasks:    make(map[string]*Task),
		addCh:    make(chan *Task, 128),
		cancelCh: make(chan string, 128),
		stopCh:   make(chan struct{}),
		doneCh:   make(chan struct{}),
	}
	heap.Init(&s.heap)
	go s.loop()
	return s
}

// Schedule 一次性延迟任务
// delay < 0 按 0 处理
func (s *Scheduler) Schedule(id string, delay time.Duration, fn func(ctx context.Context)) (context.CancelFunc, error) {
	if delay < 0 {
		delay = 0
	}
	return s.schedule(id, time.Now().Add(delay), 0, fn)
}

// ScheduleEvery 周期性任务
func (s *Scheduler) ScheduleEvery(id string, interval time.Duration, fn func(ctx context.Context)) (context.CancelFunc, error) {
	if interval <= 0 {
		return nil, fmt.Errorf("interval must be positive")
	}
	return s.schedule(id, time.Now().Add(interval), interval, fn)
}

func (s *Scheduler) schedule(id string, next time.Time, interval time.Duration, fn func(ctx context.Context)) (context.CancelFunc, error) {
	ctx, cancel := context.WithCancel(context.Background())
	t := &Task{
		ID:       id,
		Next:     next,
		Interval: interval,
		Fn:       fn,
		ctx:      ctx,
		cancel:   cancel,
	}

	select {
	case s.addCh <- t:
		return cancel, nil
	case <-s.stopCh:
		cancel()
		return nil, fmt.Errorf("scheduler stopped")
	}
}

// Cancel 取消指定任务，O(log n)
func (s *Scheduler) Cancel(id string) {
	select {
	case s.cancelCh <- id:
	case <-s.stopCh:
	}
}

// Stop 优雅关闭：取消所有任务，等正在执行的跑完
func (s *Scheduler) Stop() {
	close(s.stopCh)
	<-s.doneCh
	s.wg.Wait()
}

// loop 调度主循环
func (s *Scheduler) loop() {
	defer close(s.doneCh)

	timer := time.NewTimer(0)
	<-timer.C // drain initial

	for {
		// 看堆顶任务决定下次唤醒时间
		s.mu.Lock()
		var next *Task
		if len(s.heap) > 0 {
			next = s.heap[0]
		}
		s.mu.Unlock()

		if next == nil {
			timer.Stop()
			timer = time.NewTimer(24 * time.Hour)
		} else {
			d := time.Until(next.Next)
			if d < 0 {
				d = 0
			}
			timer.Stop()
			// Go 1.23+ Reset 安全；旧版本需 drain channel
			timer = time.NewTimer(d)
		}

		select {
		case <-s.stopCh:
			timer.Stop()
			// 取消所有未执行的任务
			s.mu.Lock()
			for _, t := range s.tasks {
				t.cancel()
			}
			s.mu.Unlock()
			return

		case t := <-s.addCh:
			s.mu.Lock()
			// ID 重复：先取消旧的
			if old, ok := s.tasks[t.ID]; ok {
				old.cancel()
				if old.index >= 0 {
					heap.Remove(&s.heap, old.index)
				}
				delete(s.tasks, old.ID)
			}
			heap.Push(&s.heap, t)
			s.tasks[t.ID] = t
			s.mu.Unlock()

		case id := <-s.cancelCh:
			s.mu.Lock()
			if t, ok := s.tasks[id]; ok {
				t.cancel()
				delete(s.tasks, id)
				if t.index >= 0 {
					heap.Remove(&s.heap, t.index)
				}
			}
			s.mu.Unlock()

		case <-timer.C:
			s.mu.Lock()
			if len(s.heap) == 0 {
				s.mu.Unlock()
				continue
			}
			t := heap.Pop(&s.heap).(*Task)
			delete(s.tasks, t.ID)
			s.mu.Unlock()

			// 执行（带 recover，防止单个任务 panic 崩掉调度器）
			s.wg.Add(1)
			go func(task *Task) {
				defer s.wg.Done()
				defer func() {
					if r := recover(); r != nil {
						// 生产环境接入日志
						_ = fmt.Errorf("task %s panic: %v", task.ID, r)
					}
				}()

				task.Fn(task.ctx)

				// 周期性任务且未取消，重新入堆
				if task.Interval > 0 && task.ctx.Err() == nil {
					task.Next = time.Now().Add(task.Interval)
					select {
					case s.addCh <- task:
					case <-s.stopCh:
						task.cancel()
					}
				}
			}(t)
		}
	}
}