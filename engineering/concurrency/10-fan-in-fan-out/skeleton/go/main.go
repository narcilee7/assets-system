package main

import (
	"fmt"
	"sync"
)

// Generate 生成 1..n。
func Generate(n int) <-chan int {
	out := make(chan int)
	go func() {
		for i := 1; i <= n; i++ {
			out <- i
		}
		close(out)
	}()
	return out
}

// SquareWorker 从 in 读取并计算平方，发送到 out。
func SquareWorker(in <-chan int, out chan<- int, wg *sync.WaitGroup) {
	defer wg.Done()
	// TODO: 从 in 读取，计算平方后发送到 out；in 关闭后退出
}

// FanOut 启动 numWorkers 个 SquareWorker，返回合并后的输出 channel。
func FanOut(in <-chan int, numWorkers int) <-chan int {
	out := make(chan int)
	var wg sync.WaitGroup
	// TODO: 启动 numWorkers 个 goroutine 执行 SquareWorker
	// TODO: 启动一个 goroutine 等待 wg 完成后关闭 out
	return out
}

// Sum 从 in 读取并求和，返回结果。
func Sum(in <-chan int) int {
	sum := 0
	for v := range in {
		sum += v
	}
	return sum
}

func main() {
	const n = 100
	const workers = 4
	expected := n * (n + 1) * (2*n + 1) / 6

	gen := Generate(n)
	squares := FanOut(gen, workers)
	actual := Sum(squares)

	if actual == expected {
		fmt.Printf("PASS: sum = %d (expected %d) with %d workers\n", actual, expected, workers)
	} else {
		fmt.Printf("FAIL: sum = %d (expected %d)\n", actual, expected)
	}
}
