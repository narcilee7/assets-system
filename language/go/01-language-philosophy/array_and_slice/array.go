package arrayandslice

import "fmt"

func TestArray() {
	var a [5]int
	b := [5]int{1, 2, 3, 4, 5}
	c := [...]int{1, 2, 3}
	fmt.Println("a", a)
	fmt.Println("b", b)
	fmt.Println("c", c)
}
