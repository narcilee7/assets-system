package main

import (
	"fmt"
	"time"
)

type Bad struct {
    A bool     // 1
    B int32    // 4
    C bool     // 1
    D int64    // 8
    E bool     // 1
}

type Good struct {
    D int64    // 8
    B int32    // 4
    A bool     // 1
    C bool     // 1
    E bool     // 1
}

// type Inner struct{}

// func (Inner) M1() {}
// func (*Inner) M2() {}

// type Outer struct {
//     Inner
// }

// var _ interface{ M1() } = Outer{}    // 合法？
// var _ interface{ M1() } = &Outer{}  // 合法？
// var _ interface{ M2() } = Outer{}     // 合法？
// var _ interface{ M2() } = &Outer{}  // 合法？
type User struct {
    Name  string `json:"name" db:"user_name"`
    Age   int    `json:"age,omitempty"`
    Email string `json:"-"`
}

// func main() {
//     t := reflect.TypeOf(User{})
//     field, _ := t.FieldByName("Name")
//     fmt.Println(field.Tag.Get("json"))   // ?
//     fmt.Println(field.Tag.Get("db"))     // ?
    
//     // 下面输出什么？
//     u := User{Age: 0}
//     b, _ := json.Marshal(u)
//     fmt.Println(string(b))  // ?
// }

// // var a interface{} = int64(42)
// var b interface{ String() string } = time.Now()

// type MyError error

// func returnsErrror() error {
// 	if true {
// 		return &MyError{}
// 	}
// 	var p *MyError = nil
// 	return p
// }

// func main() {
// 	err := returnsErrror()
// 	fmt.Println(err == nil)
// 	fmt.Println(err == (*MyError)(nil))
// }

// var a interface{} = []int{1, 2}
// var b interface{} = []int{1, 2}

// func main() {
// 	if reflect.TypeOf(a).Comparable() {
// 		if (reflect.DeepEqual(a, b)) {
// 			fmt.Println("ok")
// 		} else {
// 			fmt.Println("no")
// 		}
// 	} else {
// 		fmt.Println("is not comparable")
// 	}
// }

// var mu sync.RWMutex

// func main() {
// 	var m = map[string]int{}

// 	go func() {
// 		for {
// 			mu.Lock()
// 			m["a"] = 1
// 			mu.Unlock()
// 		}
// 	}()

// 	go func() {
// 		for {
// 			mu.Lock()
// 			_ = m["a"]
// 			mu.Unlock()
// 		}
// 	}()
// 	time.Sleep(time.Second)
// }

// func main() {
// 	m := map[int]int{1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9}

// for k := range m {
//     if k == 3 {
//         delete(m, 3)      // 合法？
//         m[10] = 10        // 合法？
//     }
//     fmt.Println(k)
// 	}
// }

// func main() {
// 	m := map[string]int{"a": 1}
// 	p := &m["a"]
// 	fmt.Println(p)
// 	m["a"]++
// }

// type FuckingName struct {
// 	Name string
// }

// func main() {
// 	m := map[string]FuckingName{"a": {"TOM"}}

// 	// m["a"].Name = "jerrcy" no 不可寻址
// 	u := m["a"]
// 	u.Name = "jeccry"
// 	m["a"] = u	
// }

// func main() {
// 	// ch := make(chan int, 2)
// 	ch := make(chan int, 3)
// 	ch <- 1
// 	ch <- 2
// 	close(ch)

// 	v1, ok1 := <-ch
// 	v2, ok2 := <-ch
// 	v3, ok3 := <-ch

// 	fmt.Println(v1, ok1)
// 	fmt.Println(v2, ok2)
// 	fmt.Println(v3, ok3)
// }



// func main() {
// 	ch1 := make(chan int, 1)
// 	ch2 := make(chan int, 2)

// 	ch1 <- 1
// 	ch2 <- 2

// 	select{
// 	case v := <-ch1:
// 		fmt.Println("ch1", v)
// 	case v := <-ch2:
// 		fmt.Println("ch2", v)
// 	default:
// 		fmt.Println("default")
// 	}
// }

func worker(done chan bool) {
	time.Sleep(time.Second)
	done <- true
}

// func main() {
// 	// 无缓冲区，done <- true阻塞，直到main接收，保证main在worker完成后继续
// 	done := make(chan bool)
// 	go worker(done)
// 	<- done
// 	fmt.Println("done")
// }

// func main() {
// 	done := make(chan bool)
// 	// // 死锁
// 	// done <- true

// 	// select + timeout
// 	// go worker(done)
// 	// fmt.Println("before gorountine done", done)
// 	// go worker(done)
// 	// fmt.Println("after gorountine", done)
// 	// select {
// 	// case <- done:
// 	// case <-time.After(5 * time.Second):
// 	// 	fmt.Println("timeout")
// 	// }

// 	// fmt.Println("done")

// 	// context
// 	ctx, cancel := context.WithCancel(context.Background())
// 	go worker(ctx)
// 	defer cancel()
// 	fmt.Println("done")
// }

type Semaphore chan struct {}

func NewSemphore(n int) Semaphore {
	return make(chan struct{}, n)
}

func (s Semaphore) Acquire() {
	s <- struct{}{}
}

// func (s Semaphore) Release() {
// 	<- s
// }

// Release直接 <-s 如果之前没有Acquire，会从空的channel阻塞等待，而不是报错，如果多个gorountine同时release，会释放不存在的许可

func (s Semaphore) Release() {
	select {
	case <- s:
		fmt.Println("release normally...")
	default:
		panic("release without acquire")
	}
}


