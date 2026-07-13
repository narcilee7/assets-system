package main

import (
	"fmt"
)

// 有类型和无类型
// const a = 10
// const b int = 20

// var f float32 = a
// // var f2 float32 = b // 不合法：无类型常量赋值的时候要显式转换
// var f2 float32 = float32(b)

// var i1 int8 = a
// // var i2 int8 = b

// var i2 int8 = int8(b)

// // question 2

// const MaxUint = ^uint(0)
// const MaxInt = int(^uint(0) >> 1)

// const x = 1 << 100
// const y = 1 << 100 >> 90
// // var z = 1 << 100 // 变量需要具体类型

// question 3

// const Pi = 3.14

// func main() {
// 	p := &Pi()
// 	fmt.Println(*p)
// }

// cannot take the address of Pi

// question 4
// const (
// 	a = iota
// 	b
// 	c = 100
// 	d
// 	e = iota
// 	f
// )

// const (
// 	g = iota
// 	h
// )

// func print()  {
// 	fmt.Println(a, b, c, d, e, f, g, h)
// }

// func main() {
// 	print()
// }

// question5

const (
	Read = 1 << iota // 1
	Write 	// 2
	Execute // 4
)

const (
	_ = iota // 0
	KB = 1 << (10 * iota) // 1 << 10 = 1024
	MB // 1 << 20
	GB // 1 << 30
)
// iota按照行计算

// q6
// const (
// 	a, b = iota, iota + 10
// 	c, d
// 	e = iota
// )

// func main() {
// 	fmt.Println(a, b, c, d, e)
// }

// q7
// type Status int

// const (
// 	Pending Status = iota
// 	Running
// 	Success
// 	Failed
// )

// func (s Status) String() string {
// 	switch s {
// 	case Pending:
// 		return "pending"
// 	case Running:
// 		return "running"
// 	case Success:
// 		return "success"
// 	case Failed:
// 		return "failed"
// 	default:
// 		return "unkown"
// 	}
// }

// func main() {
// 	fmt.Println(Pending)
// }

// q8
// const MaxSize int = 1024


// type Sizer interface {
// 	Size() int
// }

// type File struct{}

// func (f File) Size() int { return MaxSize }

// func main() {
// 	var s Sizer = File{}
// 	fmt.Println(s.Size())
// }

// q9
// const MaxInt = int(^uint(0) >> 1)

// func Max[T comparable](a, b T) T {
// 	// pass 
// }
// func Max[T constraints.Ordered](a, b T) T {
// 	if a > b {
// 		return a
// 	}
// 	return b
// }

// const A = 1 << 64          // 合法？
// const B int = 1 << 64      // 合法？
// const C = 1 << 64 >> 63    // 合法？
// const D uint64 = 1 << 64   // 合法？

// const
// q10

type Code int

const (
	_ Code = iota + 10000*1
	ErrorNotFound
	ErrUnauthorized
)


// // q14
// const (
// 	a = 1
// 	b
// 	c = iota
// 	d
// )

// const (
// 	e = iota
// 	f = iota << 1
// 	g
// 	h = iota * iota 
// )

// func main() {
// 	fmt.Println(a, b, c, d) // 1,2,2,3
// 	fmt.Println(e, f, g, h) // 0,2,4,9
// }

const (
	a = 1
	b
	c = iota
	d
)

const (
	e = iota // 0
	f = iota << 1 // 2
	g
	h = iota * iota
)

func main() {
	fmt.Println(a, b, c, d)
	fmt.Println(e, f, g, h)
}