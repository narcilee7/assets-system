package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

// call 代表一个进行中的调用。
type call struct {
	// TODO: 添加结果、错误、是否完成、等待 channel
}

// Group singleflight 组。
type Group struct {
	mu sync.Mutex
	m  map[string]*call
}

// Do 执行 fn(key)，保证相同 key 的并发调用只执行一次 fn。
func (g *Group) Do(key string, fn func() (string, error)) (string, error) {
	g.mu.Lock()
	if g.m == nil {
		g.m = make(map[string]*call)
	}
	if c, ok := g.m[key]; ok {
		g.mu.Unlock()
		// TODO: 等待 c 完成，返回共享结果
		_ = c
		return "", nil
	}
	c := &call{}
	g.m[key] = c
	g.mu.Unlock()

	// TODO: 执行 fn，保存结果，标记完成，唤醒所有等待者
	// TODO: 从 map 中删除 key（调用完成后清理）
	return "", nil
}

func main() {
	var g Group
	var execCount int64
	const n = 100

	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			v, err := g.Do("key", func() (string, error) {
				atomic.AddInt64(&execCount, 1)
				return "result", nil
			})
			if err != nil || v != "result" {
				fmt.Printf("FAIL: unexpected result %q err=%v\n", v, err)
			}
		}()
	}
	wg.Wait()

	if execCount == 1 {
		fmt.Printf("PASS: %d concurrent requests deduped to %d execution\n", n, execCount)
	} else {
		fmt.Printf("FAIL: execCount=%d (expected 1)\n", execCount)
	}
}
