package main

import "fmt"

// Generate 阶段：生成 1..n，发送到 out channel，然后关闭 out。
func Generate(n int) <-chan int {
	// TODO: 创建 out channel，启动 goroutine 生成数据，完成后关闭 out
	return nil
}

// Square 阶段：从 in 读取，计算平方，发送到 out，in 关闭后关闭 out。
func Square(in <-chan int) <-chan int {
	// TODO: 创建 out channel，启动 goroutine 处理
	return nil
}

// Sum 阶段：从 in 读取，求和，返回结果 channel（单个值）。
func Sum(in <-chan int) <-chan int {
	// TODO: 创建 out channel（缓冲 1），启动 goroutine 求和，完成后关闭 out
	return nil
}

func main() {
	const n = 100
	expected := n * (n + 1) * (2*n + 1) / 6 // 1^2 + ... + n^2

	gen := Generate(n)
	sq := Square(gen)
	result := Sum(sq)

	actual := <-result
	if actual == expected {
		fmt.Printf("PASS: sum = %d (expected %d)\n", actual, expected)
	} else {
		fmt.Printf("FAIL: sum = %d (expected %d)\n", actual, expected)
	}
}
