// package main

// import (
// 	"context"
// 	"fmt"
// 	"net/http"
// 	"time"
// )

// // func doubleSum(a, b int) (result int) {
// // 	defer func() {
// // 		fmt.Printf("result1: %d", result)
// // 		result *= 2
// // 	}()
// // 	fmt.Printf("result2: %d", result)
// // 	result = a + b
// // 	fmt.Printf("result3: %d", result)
// // 	return 100
// // }

// // func main() {
// // 	result := doubleSum(1, 2)
// // 	fmt.Println("\n")
// // 	fmt.Println(result)
// // }

// func foo(a int, b ...int) {
// 	fmt.Printf("%T, %v\n", b, b)
// 	fmt.Printf("Len%v\n", len(b))
// 	modify(b...)
// }

// func modify(b ...int) {
// 	if b == nil {
// 		return
// 	}
// 	b[0] = 100
// }

// // func main() {
// // 	s := []int{1, 2, 3}
// // 	foo(0, s...)
// // 	// foo(0, s)
// // 	foo(0, []int{1}...)
// // 	foo(0, nil...)
// // 	fmt.Println(s)
// // }

// // func a() {}
// // func b() {}

// // func main() {
// //     fmt.Println(a == b)     // 合法？
// //     fmt.Println(a == nil)   // 合法？
// //     var c func()
// //     fmt.Println(c == nil)   // 合法？
// //     fmt.Println(a == a)     // 合法？
// // }

// type Node struct {
// 	id string
// }

// type Tree struct {
// 	root *Node
// 	size int
// }

// func (t *Tree) IsEmpty() bool {
// 	return t == nil || t.root == nil
// }

// // func main() {
// // 	var t *Tree
// // 	fmt.Println(t.IsEmpty())
// // }

// // type IntSet struct {
// // 	m map[int]struct{}
// // }

// // func (s *IntSet) Add(x int) {
// // 	if s == nil {
// // 		return
// // 	}
// // 	if s.m == nil {
// // 		s.m = make(map[int]struct{})
// // 	}
// // 	s.m[x] = struct{}{}
// // // }

// // type Counter struct { n int }

// // func (c *Counter) Inc() { c.n++ }

// // func (c *Counter) Value() int { return c.n }

// // func counterDemo() {
// // 	var c Counter
// // 	p := &c

// // 	f1 := c.Inc // c.Inc == (*Counter).Inc(&c)
// // 	f2 := Counter.Inc

// // 	f3 := c.Value
// // 	f4 := p.Value
// // }

// // func main() {
// // 	var funcs []func()
// // 	for i := 0; i < 3; i++ {
// // 		funcs = append(funcs, func ()  {
// // 			fmt.Println(i)
// // 		})
// // 	}
// // 	for _, f := range funcs {
// // 		f()
// // 	}
// // }

// func counter() func() int {
// 	n := 0
// 	return func() int {
// 		n++
// 		return n
// 	}
// }

// // func main() {
// // 	c1 := counter()
// // 	c2 := counter()

// // 	fmt.Println(c1())

// // 	fmt.Println(c1())

// // 	fmt.Println(c2())

// // 	fmt.Println(c1())
// // }

// // func main() {
// //     for i := 0; i < 3; i++ {
// //         defer func() {
// //             fmt.Println(i)
// //         }()
// //     }
// //     for i := 0; i < 3; i++ {
// //         defer func(i int) {
// //             fmt.Println(i)
// //         }(i)
// //     }
// // }

// // defer
// // func main() {
// //     defer fmt.Println("1")
// //     defer fmt.Println("2")
// // 		gorountinefn()
// //     defer func() {
// //         fmt.Println("3")
// //         defer fmt.Println("4")
// //     }()
// //     fmt.Println("5")
// // }

// // func gorountinefn() {
// // 	fmt.Println("gorountine")
// // }

// // func gorountinefn1() {
// // 	fmt.Println("gorountine1")
// // }

// // func gorountinefn2() {
// // 	fmt.Println("gorountine2")
// // }

// func f() (r int) {
//     defer func() {
//         r += 10
//     }()
//     return 1
// }

// func g() int {
//     r := 1
//     defer func() {
//         r += 10
//     }()
//     return r
// }

// func h() (r int) {
//     t := 1
//     defer func() {
//         t += 10
//     }()
//     return t
// }

// // func main() {
// // 	fmt.Println(f())
// // 	fmt.Println(g())
// // 	fmt.Println(h())
// // }

// // func main() {
// //     defer func() {
// //         if r := recover(); r != nil {
// //             fmt.Println("recovered:", r)
// //         }
// //     }()

// //     defer func() {
// //         panic("second panic")
// //     }()

// //     panic("first panic")
// // }

// type Handler interface {
// 	ServerHTTP(w http.ResponseWriter, r *http.Request)
// }

// type HandlerFunc func(http.ResponseWriter, *http.Request)

// func (f HandlerFunc) ServerHTTP(w http.ResponseWriter, r *http.Request) {
// 	f(w, r)
// }

// func myHandler(w http.ResponseWriter, r *http.Request) {
// 	w.Write([]byte("hello"))
// }

// // func main() {
// // 	var h Handler = HandlerFunc(myHandler)
// // 	h.ServerHTTP(nil, nil)
// // }

// type Server struct {
// 	addr string
// 	timeout time.Duration
// 	maxConn int
// }

// type Option func(*Server)

// func WithAddr(addr string) Option {
// 	return func(s *Server) {
// 		s.addr = addr
// 	}
// }

// func WithTimeout(t time.Duration) Option {
//     return func(s *Server) {
//         s.timeout = t
//     }
// }

// func NewServer(opts ...Option) *Server {
// 	s := &Server{
// 		addr: ":8000",
// 		timeout: 30 *time.Second,
// 	}
// 	for _, opt := range opts {
// 		opt(s)
// 	}
// 	return s
// }

// func factorial(n int) int {
// 	if n <= 1 {
// 		return 1
// 	}
// 	return n * factorial(n - 1)
// }

// func factorialTail(n, acc int) int {
//     if n <= 1 {
//         return acc
//     }
//     return factorialTail(n-1, n*acc)
// }

// // final
// func finalTest() (result int) {
//     defer func() {
//         result++
//         if r := recover(); r != nil {
//             result += 100
//         }
//     }()

//     defer func() {
//         result *= 10
//         panic("inner panic")
//     }()

//     return 5
// }

// // func main() {
// // 	fmt.Println(finalTest())
// // }

// func RunWithTimeout[T any](fn func() T, timeout time.Duration) (T, error) {
// 	var zero T
// 	result := make(chan T, 1)

// 	go func() {
// 		defer func() {
// 			if r := recover(); r != nil {
// 				fmt.Println("panic recover error", nil)
// 			}
// 		}()
// 		result <- fn()
// 	}()

// 	select {
// 	case v := <-result:
// 		return v, nil
// 	case <- time.After(timeout):
// 		return zero, context.DeadlineExceeded
// 	}
// }

package main

import "fmt"

// func foo(a int, b ...int) {
// 	fmt.Printf("%T, %v\n", b, b)
// }

// func main() {
// 	s := []int{1, 2, 3}
// 	foo(0, s...)
// 	// foo(0, s)
// 	foo(0, []int{1}...)
// }

func main() {
	for i := 0; i < 3; i++ {
		defer func() {
			fmt.Println(i)
		}()
	}

	for i := 0; i < 3; i++ {
		defer func(i int){
			fmt.Println(i)
		}(i)
	}
}