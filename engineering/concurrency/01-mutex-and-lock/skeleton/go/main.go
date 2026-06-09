package main

import (
	"fmt"
	"sync"
)

// SafeCounter 是线程安全的计数器。
// TODO: 在此添加必要的同步原语字段。
type SafeCounter struct {
	// TODO
	count int
}

// Inc 对计数器递增 1。
func (c *SafeCounter) Inc() {
	// TODO: 获取锁、递增、释放锁
	c.count++
}

// Value 返回当前计数值。
func (c *SafeCounter) Value() int {
	// TODO: 获取锁、读取、释放锁
	return c.count
}

func main() {
	const n = 100  // 并发执行单元数量
	const m = 1000 // 每个单元递增次数

	var wg sync.WaitGroup
	counter := &SafeCounter{}

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < m; j++ {
				counter.Inc()
			}
		}()
	}

	wg.Wait()

	expected := n * m
	actual := counter.Value()
	if actual == expected {
		fmt.Printf("PASS: count = %d (expected %d)\n", actual, expected)
	} else {
		fmt.Printf("FAIL: count = %d (expected %d)\n", actual, expected)
	}
}
