package function

import "fmt"

func apply(a, b int, f func(int, int) int) int {
	return f(a, b)
}

func makeMultiplier(factor int) func(int) int {
	return func(i int) int {
		return i * factor
	}
}

func TestFuncFirst() {
	var f func(int) int
	fmt.Println(f == nil) // true，函数零值是 nil
	// 非 nil 的函数值只能用 == nil 比较，不能互相比较
}
