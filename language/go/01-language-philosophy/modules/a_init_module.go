package modules

import "fmt"

func init() {
	fmt.Print("a module init\n")
}

func AInitTrigger() {
	fmt.Print("a module trigger\n")
}
