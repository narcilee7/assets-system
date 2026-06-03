package function

import "fmt"

func makeCounter() func() int {
	count := 0
	return func() int {
		count++
		return count
	}
}

func TestFuncClosure() {
	c1 := makeCounter()
	c2 := makeCounter()

	fmt.Println(c1()) // 1
	fmt.Println(c1()) // 2
	fmt.Println(c2()) // 1（独立的闭包）
}
