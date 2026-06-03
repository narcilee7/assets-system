package pointer

import "fmt"

func DebugLoopvariable() {
	items := []int{1, 2, 3}
	ptrs := make([]*int, 3)
	fmt.Println("items", items)
	fmt.Println("ptrs", ptrs)
	for i, v := range items {
		ptrs[i] = &v
	}
	fmt.Println(ptrs)
	for i := range items {
		ptrs[i] = &items[i]
	}
	fmt.Println(ptrs)
}
