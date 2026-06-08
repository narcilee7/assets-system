package main

import (
	"fmt"
	"sync"
	"time"
)

// MyRWMutex 是简易读写锁。
// TODO: 添加必要的状态字段和条件变量。
type MyRWMutex struct {
	mu sync.Mutex
	// TODO: readerCount, writerWaiting, writerActive 等
}

func (rw *MyRWMutex) RLock() {
	rw.mu.Lock()
	defer rw.mu.Unlock()
	// TODO: 如果有活跃写者或等待写者，条件等待；否则增加 readerCount
}

func (rw *MyRWMutex) RUnlock() {
	rw.mu.Lock()
	defer rw.mu.Unlock()
	// TODO: 减少 readerCount，如果是最后一个读者且有写者等待，唤醒写者
}

func (rw *MyRWMutex) Lock() {
	rw.mu.Lock()
	defer rw.mu.Unlock()
	// TODO: 标记有写者等待；如果有活跃读者或写者，条件等待；否则获取写锁
}

func (rw *MyRWMutex) Unlock() {
	rw.mu.Lock()
	defer rw.mu.Unlock()
	// TODO: 释放写锁，唤醒所有等待的读者或下一个写者
}

func main() {
	var rw MyRWMutex
	var wg sync.WaitGroup
	activeReaders := 0
	maxReaders := 0
	var mu sync.Mutex
	writeDuringRead := false

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			rw.RLock()

			mu.Lock()
			activeReaders++
			if activeReaders > maxReaders {
				maxReaders = activeReaders
			}
			mu.Unlock()

			time.Sleep(20 * time.Millisecond)

			mu.Lock()
			activeReaders--
			mu.Unlock()

			rw.RUnlock()
		}(i)
	}

	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			rw.Lock()

			mu.Lock()
			if activeReaders > 0 {
				writeDuringRead = true
				fmt.Printf("FAIL: writer %d sees activeReaders=%d\n", id, activeReaders)
			}
			mu.Unlock()

			time.Sleep(20 * time.Millisecond)
			rw.Unlock()
		}(i)
	}

	wg.Wait()
	if !writeDuringRead {
		fmt.Printf("PASS: max concurrent readers = %d\n", maxReaders)
	}
}
