package modules

import "fmt"

func init() {
	fmt.Print("b module init\n")
}

func BInitTrigger() {
	fmt.Print("b init trigger\n")
}
