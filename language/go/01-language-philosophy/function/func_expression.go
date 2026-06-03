package function

import "math"

type Point struct {
	X, Y float64
}

func (p Point) Distance(q Point) float64 {
	dx := p.X - q.X
	dy := p.Y - q.Y
	return math.Sqrt(dx*dx + dy*dy)
}

// func TestFuncExpression() {
// 	p := Point{1, 2}
// 	f := p.Distance

// 	g := Point.Distance
// }
