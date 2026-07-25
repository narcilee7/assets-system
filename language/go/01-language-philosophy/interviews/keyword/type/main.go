package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
)

// type MyInt int
// type IntAlias int

// var a int = 10
// // var b MyInt = a

// type MyInt int

// func (m MyInt) String() string {
// 	return fmt.Sprintf("MyInt(%d)", m)
// }

// type IntAlias = int

// func (i IntAlias) String() string {
// 	return fmt.Sprintf("IntAlias(%d)", i)
// }

// type T struct{}

// func (T) ValueMethod() {}
// func (*T) PtrMethod() {}

// var t T
// var p = &t

// var _ interface{ ValueMethod() } = t   // 合法？
// var _ interface{ ValueMethod() } = p     // 合法？
// var _ interface{ PtrMethod() } = t      // 合法？
// var _ interface{ PtrMethod() } = p       // 合法？

// type T struct { X int }

// func (t * T) SetX(x int) {
// 	t.X = x
// }

// func main() {
//     T{}.SetX(10)        // 合法？
//     T{X: 1}.SetX(10)    // 合法？
//     var t T
//     t.SetX(10)          // 合法？
// }

// type Reader interface {
// 	Read (p []byte) (n int, err error)
// }

// type ReadCloser interface {
// 	Reader
// 	Close() error
// }

// type MyReader struct{}

// func (MyReader) Read(p []byte) (n int, err error) {
// 	return 0, nil
// }

// func (MyReader) Close() error {
// 	return nil
// }

// var _ ReadCloser = MyReader{}  // 合法？

// type Inner struct{}

// func (Inner) Method() {}
// func (*Inner) PtrMethod() {}

// type Outer struct {
// 	Inner
// }

// var o Outer
// var p = &o

// var _ interface { Method() } = o
// var _ interface{ Method() } = p     // 合法？
// var _ interface{ PtrMethod() } = o   // 合法？
// var _ interface{ PtrMethod() } = p  // 合法？

// type MyInt int
// type MyFloat float64

// var a int = 10
// var b MyInt = MyInt(a)     // 合法？

// var c float64 = 3.14
// var d MyInt = MyInt(c)     // 合法？

// var e MyFloat = 3.14
// var f MyInt = MyInt(e)     // 合法？

// var p *int = nil
// var i interface{} = p

// func main() {
// 	v, ok := i.(*int)
// 	fmt.Println(v == nil)
// 	fmt.Println(ok)
// 	fmt.Println(i == nil)
// }

// type Bad struct {
//     A bool     // 1 byte
//     B int64    // 8 bytes
//     C bool     // 1 byte
// }

// type Good struct {
//     B int64    // 8 bytes
//     A bool     // 1 byte
//     C bool     // 1 byte
// }

// fmt.Println(unsafe.Sizeof(Bad{}))   // ?
// fmt.Println(unsafe.Sizeof(Good{}))  // ?

// type Empty struct{}

// var e Empty

// func printEmpty() {
// 	fmt.Println(unsafe.Sizeof(e))
// }

// type WithEmpty struct {
// 	A int
// 	B Empty
// 	C int
// }

// func printWithEmpty() {
// 	fmt.Println(unsafe.Sizeof(WithEmpty{}))
// }

// func main() {
// 	printEmpty()
// 	printWithEmpty()
// }

type Handler func(ctx context.Context, req http.Request) (http.Response, error)


func LoggingHandler(h Handler) Handler {
	return func(ctx context.Context, req http.Request) (http.Response, error) {
		log.Println("before")
		resp, err := h(ctx, req)
		log.Println("after")
		return resp, err
	}
}

// func AuthHandler(h Handler) Handler {
//     return func(ctx context.Context, req Request) (Response, error) {
//         if !checkAuth(req) {
//             return Response{}, errors.New("unauthorized")
//         }
//         return h(ctx, req)
//     }
// }

type Number interface {
	~int | ~int64 | ~float64
}

type MyInt int

func Add[T Number](a, b T) T {
	return a + b
}

func main() {
	fmt.Println(Add(1, 2))
	fmt.Println(Add(MyInt(1), MyInt(2)))
	fmt.Println(Add(1.5, 2.5))
}

