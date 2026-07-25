package main

import (
	"database/sql"
	"fmt"
	"sync"
	"sync/atomic"
)

// 0值 q3
// func print() {
// 	var a int
// 	var b string
// 	var c []int
// 	var d map[string]int
// 	var e *int
// 	var f func()
// 	var g interface{}
// 	var h struct{ X int }

// 	fmt.Println(a == 0)       // ?
// 	fmt.Println(b == "")      // ?
// 	fmt.Println(c == nil)     // ?
// 	fmt.Println(d == nil)     // ?
// 	fmt.Println(e == nil)     // ?
// 	fmt.Println(f == nil)     // ?
// 	fmt.Println(g == nil)     // ?
// 	fmt.Println(h == struct{ X int }{}) // ?
// }

// func loop() {
// 	for i := 0; i < 3; i++ {
// 		var v = i
// 		go func() {
// 			fmt.Println(v)
// 		}()
// 	}
// 	time.Sleep(time.Second)
// }

// func main() {
// 	loop()
// }

// func initPackage() int {
// 	fmt.Println("init package called")
// 	return 42
// }

// var _ = initPackage() // 1

// func main() {
// 	fmt.Println("main")
// }

/// q8
// func foo() *int {
// 	var x = 20
// 	return &x
// }

// func bar() int {
// 	var y = 20
// 	return y
// }

// func baz() {
// 	var z = 30
// 	fmt.Println(z)
// }

// q9
// var a *int = new(int)
// var b *int
// // var c = &int{}
// var d = &struct{}{}

// func makeFuncs() []func() {
// 	var funcs []func()
// 	for i := 0; i < 3; i++ {
// 		var v = i * 10
// 		funcs = append(funcs, func() {
// 			fmt.Println(v)
// 		})
// 	}
// 	return funcs
// }

// func main() {
// 	for _, f := range makeFuncs() {
// 		f()
// 	}
// }

// q11
var counter int
var mu sync.Mutex

func inc() {
	for i := 0; i < 1000;i++{
		// yuanzi
		mu.Lock()
		counter++
		mu.Unlock()
	}
}

// func main() {
// 	var wg sync.WaitGroup
// 	for i := 0; i < 100; i++ {
// 		wg.Add(1)
// 		go func() {
// 			defer wg.Done()
// 			inc()
// 		}()
// 	}
// 	wg.Wait()
// 	fmt.Println(counter)
// }

// 12
// var ch chan int
// var ch = make(chan int)

// func main() {
// 	fmt.Println(ch)
// 	go func() {
// 		ch <- 1
// 	}()
// 	time.Sleep(time.Second)
// 	fmt.Println("done")

// }

// 13
// var config map[string]string
// var once sync.Once

// func loadConfig() {
// 	config = map[string]string{
// 		"k": "value",
// 	}
// }

// func getConfig() {
// 	once.Do(loadConfig)
// 	return config
// }


// `sync.Once` 保证 `loadConfig` 只执行一次，但 `var config` 的**内存可见性**有问题。

var config atomic.Value
var once sync.Once

func load() {
	m := map[string]string{
		"key": "value",
	}
	config.Store(m) // atomic store
}

func getConfig() map[string]string {
	once.Do(load)
	return config.Load().(map[string]string)
}

// var _ io. 
// type MyReader interface {
// 	io.Reader
// 	io.Writer
// }

// var _ io.Reader = (*MyReader)(nil)

var DB *sql.DB

func InitDB(connStr string) error {
	var err error
	DB, err =sql.Open("mysql", connStr)
	return err
}

var x = 100

func main() {
    fmt.Println(x)        // 1
    x := 200              // 2
    fmt.Println(x)        // 3
    {
        fmt.Println(x)    // 4
        x := 300          // 5
        fmt.Println(x)    // 6
    }
    fmt.Println(x)        // 7
    x, y := 400, 500      // 8
    fmt.Println(x, y)   // 9
}