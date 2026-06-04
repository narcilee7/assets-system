package grountinewithchannel

import "fmt"

func basic() {
	go func() {
		fmt.Println("running in gorountine")
	}()
}

func gorountineClosureError() {
	for _, item := range []string{"a", "b", "c"} {
		go func() {
			fmt.Println(item)
		}()
	}
}

func gorountineClosureByParams() {
	for _, item := range []string{"a", "b", "c"} {
		go func(item string) {
			fmt.Println(item)
		}(item)
	}
}

func gorountineClosureByCopy() {
	for _, item := range []string{"a", "b", "c"} {
		cItem := item
		go func() {
			fmt.Println(cItem)
		}()
	}
}

func compute() int {
	for range 10000 {
	}
	return 42
}

func gorountineBad() int {

	result := 0
	go func() {
		result = compute()
	}()
	return result
}

func DebugGorountineBad() {
	basic()

	gorountineClosureError()

	gorountineClosureByParams()

	gorountineClosureByCopy()

	gorountineBad()
}
