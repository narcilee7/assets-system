package main

import (
	"fmt"
	"sync"
	"time"
)

const numPhilosophers = 5

// Chopstick 代表一根筷子，用互斥锁模拟。
type Chopstick struct {
	sync.Mutex
}

// Philosopher 代表一位哲学家。
type Philosopher struct {
	id          int
	left, right *Chopstick
}

func (p *Philosopher) Dine(wg *sync.WaitGroup, eatCount *int, mu *sync.Mutex) {
	defer wg.Done()
	for i := 0; i < 10; i++ {
		// 思考
		time.Sleep(time.Millisecond)

		// TODO: 实现就餐逻辑，避免死锁
		// 策略选项（选其一）：
		// 1. 资源排序：总是先拿编号小的筷子
		// 2. 限制同时就餐人数：最多 4 人同时尝试拿筷子
		// 3. 非对称策略：偶数 id 先左后右，奇数 id 先右后左

		p.left.Lock()
		p.right.Lock()
		// 就餐
		mu.Lock()
		*eatCount++
		mu.Unlock()
		time.Sleep(time.Millisecond)
		p.right.Unlock()
		p.left.Unlock()
	}
}

func main() {
	chopsticks := make([]*Chopstick, numPhilosophers)
	for i := 0; i < numPhilosophers; i++ {
		chopsticks[i] = &Chopstick{}
	}

	philosophers := make([]*Philosopher, numPhilosophers)
	for i := 0; i < numPhilosophers; i++ {
		philosophers[i] = &Philosopher{
			id:    i,
			left:  chopsticks[i],
			right: chopsticks[(i+1)%numPhilosophers],
		}
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	eatCount := 0

	done := make(chan struct{})
	go func() {
		for _, p := range philosophers {
			wg.Add(1)
			go p.Dine(&wg, &eatCount, &mu)
		}
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		expected := numPhilosophers * 10
		if eatCount == expected {
			fmt.Printf("PASS: all %d meals completed without deadlock\n", eatCount)
		} else {
			fmt.Printf("FAIL: eatCount=%d (expected %d)\n", eatCount, expected)
		}
	case <-time.After(5 * time.Second):
		fmt.Println("FAIL: timeout, likely deadlock")
	}
}
