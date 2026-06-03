package ddefer

import "fmt"

func f() {
	defer fmt.Println("3")
	defer fmt.Println("2")
	defer fmt.Println("1")
	fmt.Println("0")
}

func doubleSum(a, b int) (sum int) {
	defer func() {
		sum *= 2
	}()
	sum = a + b
	return
}

func deferWithClosure() {
	items := []int{1, 2, 3}
	for _, item := range items {
		defer fmt.Println(item)
	}
}

func DebugDefer() {
	f()
	fmt.Println(doubleSum(1, 2))
}
