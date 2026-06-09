package main

import (
	"fmt"
	"sync"
	"time"
)

// Barrier 线程屏障。
// TODO: 添加 count（已到达数）、total（总数）、generation（代）和条件变量。
type Barrier struct {
	mu sync.Mutex
	// TODO
}

func NewBarrier(n int) *Barrier {
	// TODO: 初始化
	return &Barrier{}
}

// Wait 等待所有参与者到达。最后到达的参与者负责重置并唤醒所有人。
func (b *Barrier) Wait() {
	b.mu.Lock()
	defer b.mu.Unlock()
	// TODO:
	// 1. 记录当前代
	// 2. 增加到达计数
	// 3. 如果是最后一个到达：重置计数、增加代、唤醒所有等待者
	// 4. 否则：循环等待，直到代发生变化（防止虚假唤醒）
}

func main() {
	const n = 5
	const phases = 3

	barrier := NewBarrier(n)
	var wg sync.WaitGroup
	arrivalTimes := make([][]time.Time, n)

	for i := 0; i < n; i++ {
		arrivalTimes[i] = make([]time.Time, phases)
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for phase := 0; phase < phases; phase++ {
				time.Sleep(time.Duration(id*10) * time.Millisecond)
				barrier.Wait()
				arrivalTimes[id][phase] = time.Now()
			}
		}(i)
	}

	wg.Wait()

	pass := true
	for phase := 0; phase < phases; phase++ {
		maxDiff := time.Duration(0)
		for i := 1; i < n; i++ {
			diff := arrivalTimes[i][phase].Sub(arrivalTimes[0][phase])
			if diff < 0 {
				diff = -diff
			}
			if diff > maxDiff {
				maxDiff = diff
			}
		}
		if maxDiff > 50*time.Millisecond {
			fmt.Printf("FAIL: phase %d max arrival diff = %v\n", phase, maxDiff)
			pass = false
		}
	}
	if pass {
		fmt.Println("PASS: all phases synchronized")
	}
}
