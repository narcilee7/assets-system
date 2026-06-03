package interfaces

import "fmt"

// type DebugBoxing
func DebugBoxing() {
	var x int = 42
	var i interface{} = x
	fmt.Println(i)
}
