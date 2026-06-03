package forloop

import "fmt"

func TestForLoop() {
	items := []string{"a", "b", "c"}

	for _, item := range items {
		go func() {
			fmt.Println(item)
		}()
	}

	for _, item := range items {
		cpItem := item
		go func() {
			fmt.Println(cpItem)
		}()
	}
}
