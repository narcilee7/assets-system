package main

import (
	"fmt"
	"sync"
)

// BoundedBuffer 有界缓冲区。
// TODO: 添加 buffer 切片、头尾索引、计数、互斥锁和条件变量。
type BoundedBuffer struct {
	mu sync.Mutex
	// TODO
}

func NewBoundedBuffer(capacity int) *BoundedBuffer {
	// TODO: 初始化
	return &BoundedBuffer{}
}

// Produce 向缓冲区放入一个元素。若缓冲区满，阻塞等待。
func (b *BoundedBuffer) Produce(item int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	// TODO: 等待 notFull，放入元素，通知 notEmpty
}

// Consume 从缓冲区取出一个元素。若缓冲区空，阻塞等待。
func (b *BoundedBuffer) Consume() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	// TODO: 等待 notEmpty，取出元素，通知 notFull
	return 0
}

func main() {
	const capacity = 10
	const numProducers = 5
	const numConsumers = 3
	const itemsPerProducer = 100

	buffer := NewBoundedBuffer(capacity)
	var wg sync.WaitGroup
	var sum int64
	var mu sync.Mutex

	// 生产者
	for i := 0; i < numProducers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < itemsPerProducer; j++ {
				item := id*itemsPerProducer + j
				buffer.Produce(item)
			}
		}(i)
	}

	// 消费者
	for i := 0; i < numConsumers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < (numProducers*itemsPerProducer)/numConsumers; j++ {
				item := buffer.Consume()
				mu.Lock()
				sum += int64(item)
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	expectedSum := int64(numProducers*itemsPerProducer-1) * int64(numProducers*itemsPerProducer) / 2
	if sum == expectedSum {
		fmt.Printf("PASS: sum = %d (expected %d)\n", sum, expectedSum)
	} else {
		fmt.Printf("FAIL: sum = %d (expected %d)\n", sum, expectedSum)
	}
}
