package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// ReadersWriters 实现写者优先的读者写者控制器。
type ReadersWriters struct {
	mu sync.Mutex
	// TODO: 添加 readerCount, writerWaiting, writerActive 等状态
	// TODO: 添加条件变量
}

func (rw *ReadersWriters) StartRead() {
	rw.mu.Lock()
	defer rw.mu.Unlock()
	// TODO: 如果有写者等待或活跃，条件等待；否则增加 readerCount
}

func (rw *ReadersWriters) EndRead() {
	rw.mu.Lock()
	defer rw.mu.Unlock()
	// TODO: 减少 readerCount；如果是最后一个读者且有写者等待，唤醒写者
}

func (rw *ReadersWriters) StartWrite() {
	rw.mu.Lock()
	defer rw.mu.Unlock()
	// TODO: 标记有写者等待；如果有读者或写者活跃，条件等待；否则标记 writerActive
}

func (rw *ReadersWriters) EndWrite() {
	rw.mu.Lock()
	defer rw.mu.Unlock()
	// TODO: 取消 writerActive；优先唤醒等待的写者，否则唤醒所有等待的读者
}

func main() {
	var rw ReadersWriters
	var wg sync.WaitGroup
	writeOccurred := int32(0)

	// 大量读者
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				rw.StartRead()
				time.Sleep(time.Millisecond)
				rw.EndRead()
			}
		}(i)
	}

	// 一个写者
	wg.Add(1)
	go func() {
		defer wg.Done()
		rw.StartWrite()
		atomic.StoreInt32(&writeOccurred, 1)
		time.Sleep(5 * time.Millisecond)
		rw.EndWrite()
	}()

	// 给读者一点时间先启动，制造竞争
	time.Sleep(10 * time.Millisecond)

	wg.Wait()
	if atomic.LoadInt32(&writeOccurred) == 1 {
		fmt.Println("PASS: writer was not starved")
	} else {
		fmt.Println("FAIL: writer starved or error")
	}
}
