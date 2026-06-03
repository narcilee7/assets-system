package structs

import "fmt"

type Point struct {
	X, Y float64
}

func debugStruct() {
	p := Point{X: 1, Y: 2} // 命名字段

	pp := &Point{X: 1, Y: 2}

	fmt.Print(p, pp)
}
