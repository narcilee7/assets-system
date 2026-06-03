package variable

import "fmt"

func DefineVariables() {
	var x int = 10

	var s = "hello"

	var xx int
	var ss string
	var p *int

	var (
		name    = "Go"
		version = 1.21
	)

	fmt.Println("x", x)

	fmt.Println("s", s)

	fmt.Println("xx", xx)

	fmt.Println("ss", ss)

	fmt.Println("p", p)

	fmt.Printf("name: %s, version: %f\n", name, version)
}

func DefineConstants() {
	const Pi = 3.14159
	const MaxSize = 100

	const (
		Sunday = iota
		Monday
		Tuesday
		Wednesday
		Thursday
		Friday
		Saturday
	)

	const (
		_  = iota
		KB = 1 << (10 * iota)
		MB = 1 << (10 * iota)
		GB = 1 << (10 * iota)
	)

	fmt.Println("KB", KB)
	fmt.Println("MB", MB)
	fmt.Println("GB", GB)
}
