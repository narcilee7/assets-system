package mmap

import "fmt"

func loopMap() {
	var m map[string]int = map[string]int{
		"a": 1,
		"b": 2,
	}
	for k, v := range m {
		fmt.Printf("%s: %d\n", k, v)
	}
}
