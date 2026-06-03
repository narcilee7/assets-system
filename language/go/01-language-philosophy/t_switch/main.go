package tswitch

import "fmt"

func TestSwitch() {
	var x int = 3

	switch x {
	case 1, 2, 3:
		fmt.Println("small")
	case 4, 5, 6:
		fmt.Println("medium")
	case 7, 8, 9:
		fmt.Println("large")
	default:
		fmt.Println("unknown")
	}

	switch {
	case x < 0:
		fmt.Println("negative")
	case x > 0:
		fmt.Println("positive")
	default:
		fmt.Println("zero")
	}
}
