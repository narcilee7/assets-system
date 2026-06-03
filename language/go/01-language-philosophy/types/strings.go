package types

import "fmt"

func StringTest() {
	s := "hello, world"

	// for loop of string
	for i := 0; i < len(s); i++ {
		// 打印类型 s[i]是byte(uint8)
		fmt.Printf("%T\n", s[i])
		fmt.Println(string(s[i]))
	}

	// for range of string
	for _, r := range s {
		fmt.Printf("%T\n", r)
		fmt.Println(string(r))
	}
}
