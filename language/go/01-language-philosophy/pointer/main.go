package pointer

import "fmt"

func basic() {
	var x int = 10
	var p *int = &x

	fmt.Println(*p)
	*p = 20
	fmt.Println(*p)

}

func nilPointer() {
	var p *int
	fmt.Println(p == nil)
	// fmt.Println(*p) // panic: runtime error: invalid memory address
}

// 值传递
func modify(p int) {
	p = 100
}

// 传递指针
func modifyPointer(p *int) {
	*p = 100
}

func TestPointer() {
	basic()
	// nilPointer()
	a := 1
	modify(a)
	fmt.Println(a)
	modifyPointer(&a)
	fmt.Println(a)
}
