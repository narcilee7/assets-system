package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// Semaphore 计数信号量。
// TODO: 添加计数器和条件变量。
type Semaphore struct {
	mu sync.Mutex
	// TODO
}

func NewSemaphore(n int) *Semaphore {
	// TODO: 初始化信号量，初始值为 n
	return &Semaphore{}
}

func (s *Semaphore) Acquire() {
	s.mu.Lock()
	defer s.mu.Unlock()
	// TODO: 如果计数器为 0，条件等待；否则减 1
}

func (s *Semaphore) Release() {
	s.mu.Lock()
	defer s.mu.Unlock()
	// TODO: 加 1，如果有等待者，唤醒一个
}

func main() {
	const maxConcurrent = 5
	const totalWorkers = 50

	sem := NewSemaphore(maxConcurrent)
	var wg sync.WaitGroup
	var current int64
	var maxObserved int64

	for i := 0; i < totalWorkers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			sem.Acquire()

			c := atomic.AddInt64(&current, 1)
			for {
				m := atomic.LoadInt64(&maxObserved)
				if c <= m || atomic.CompareAndSwapInt64(&maxObserved, m, c) {
					break
				}
			}

			time.Sleep(10 * time.Millisecond)
			atomic.AddInt64(&current, -1)
			sem.Release()
		}(i)
	}

	wg.Wait()
	if maxObserved <= maxConcurrent {
		fmt.Printf("PASS: max observed concurrency = %d (limit = %d)\n", maxObserved, maxConcurrent)
	} else {
		fmt.Printf("FAIL: max observed concurrency = %d (limit = %d)\n", maxObserved, maxConcurrent)
	}
}
