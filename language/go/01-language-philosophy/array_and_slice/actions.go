package arrayandslice

import "fmt"

func appendDebug() {
	s := []int{1, 2, 3}
	s = append(s, 3)
	s = append(s, 4, 5)
}

func copyDebug() {
	dst := make([]int, 3)
	src := []int{1, 2, 3, 4, 5}
	n := copy(dst, src)
	fmt.Println("n", n)
	fmt.Println("dst", dst)
	fmt.Println("src", src)
}
