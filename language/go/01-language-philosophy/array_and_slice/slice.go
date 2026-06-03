package arrayandslice

import "fmt"

func TestSlice() {
	s := []int{1, 2, 3}
	ss := make([]int, 5)
	sss := make([]int, 3, 10)

	fmt.Println("s", s)
	fmt.Println("ss", ss)
	fmt.Println("sss", sss)

	// 从数组创建切片
	arr := [5]int{1, 2, 3, 4, 5}
	slice := arr[1:3]
	fmt.Println("slice", slice)

}
