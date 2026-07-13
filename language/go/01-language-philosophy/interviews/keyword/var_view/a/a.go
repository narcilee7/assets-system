package a

import (
	"fmt"
)

var a int

func init() {
	fmt.Println("a module init")
	// a = bbbb.B + 1
	// a = bbbb.b + 1
	fmt.Printf("A: %s", a)
}