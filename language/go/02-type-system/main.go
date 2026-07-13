package main

import "sync/atomic"

// var a = 1

// func init() {
// 	a = 2
// }

// func main() {
// 	fmt.Println(a)
// }

// modul

// var a string

// func f() {
// 	fmt.Println(a)
// }

// func main() {
// 	fmt.Println(a)
// 	a = "hello"
// 	fmt.Println(a)
// 	go f()
// }

// var wg sync.WaitGroup

// var a string

// func f() {
// 	fmt.Println(a)
// 	wg.Done()
// }

// func main() {
// 	wg.Add(1)
// 	a = "hello"
// 	go f()
// 	// time.Sleep(time.Second)
// 	wg.Wait()
// }

// var a string
// var done = make(chan bool)

// func setup() {
// 	a = "hello"
// 	done <- true
// }

// func main() {
// 	go setup()
// 	<- done
// 	fmt.Println(a)
// }

// var a string
// var done = make(chan bool)

// func setup() {
// 	a = "hello"
// 	close(done)
// }

// func main() {
// 	go setup()
// 	<- done
// 	fmt.Println(a)

// 	v, ok := <-done
// 	fmt.Println(v, ok)
// }

// var a string
// var mu sync.Mutex

// func f() {
// 	a = "hello"
// 	mu.Unlock()
// }

// func main() {
// 	mu.Lock()
// 	go f()
// 	mu.Lock()
// 	fmt.Println(a)
// }

// var mu sync.Mutex
// var a, b int

// func f() {
// 	a = 1
// 	mu.Unlock()
// }

// func g() {
// 	// mu.Lock()
// 	b = a
// 	mu.Unlock()
// }

// func main() {
// 	mu.Lock()
// 	go f()
// 	mu.Lock()
// 	go g()
// 	time.Sleep(time.Second)
// 	fmt.Println(b)
// }

// var flag int32
// var msg string

// func setup() {
// 	msg = "hello"
// 	atomic.StoreInt32(&flag, 1)
// }

// func main() {
// 	for atomic.LoadInt32(&flag) == 0 {
// 		runtime.Gosched()
// 	}
// 	fmt.Println(msg)
// }

// var once sync.Once
// var a string

// func setup() {
// 	a = "hello"
// }

// func main() {
// 	once.Do(setup)
// 	go once.Do(setup)
// 	fmt.Println(a)
// }
// var wg sync.WaitGroup
// var s string

// func setup() {
// 	s = "helllo"
// 	wg.Done()
// }

// func main() {
// 	wg.Add(1)
// 	go setup()
// 	wg.Wait()
// 	fmt.Println(s)

// 	// go setup()
// 	// wg.Add(1)
// 	// wg.Wait()
// }

// Gorountine lifecyele
// var s string
// var done = make(chan bool)

// func hello() {
// 	s = "hello"
// 	done <- true
// }

// func main() {
// 	go hello()
// 	<-done
// 	fmt.Println(s)
// }

// var wg sync.WaitGroup
// var s string

// func set(){
// 	s = "hello"
// 	wg.Done()
// }

// func main() {
// 	wg.Add(1)
// 	go set()
// 	wg.Wait()
// 	fmt.Println(s)
// }

// var ready atomic.Bool

// func setup() {
// 	s = "hello"
// 	ready.Store(true)
// }

// func main() {
// 	for !ready.Load() {
// 		fmt.Println("block")
// 	}
// 	fmt.Println(s)
// }

// var a = "hello"

// func main() {
// 	a = "world"
// 	go func() {
// 		fmt.Println(a)
// 	}()
// 	time.Sleep(time.Second)
// }

// Data Race
// var a int
// func main() {
// 	go func() { a = 1 }()
// 	go func() { a = 2 }()
// 	time.Sleep(time.Second)
// 	fmt.Println(a)
// }

type Node struct {
	value int
	next atomic.Pointer[Node]
}

type LockFreeQueue struct {
	head atomic.Pointer[Node]
	tail atomic.Pointer[Node]
}

func NewLockFreeQueue() *LockFreeQueue {
	dummy := &Node{}
	q := &LockFreeQueue{}
	q.head.Store(dummy)
	q.tail.Store(dummy)
	return q
}

func (q *LockFreeQueue) Enqueue(v int) {
	newNode := &Node{value: v}

	for {
		tail := q.tail.Load()
		next := tail.next.Load()

		if tail == q.tail.Load() {
			if next == nil {
				if tail.next.CompareAndSwap(next, newNode) {
					q.tail.CompareAndSwap(tail, newNode)
					return
				}
			} else {
				q.tail.CompareAndSwap(tail, next)
			}
		}
	}
}

func (q *LockFreeQueue) Dequeue() (int, bool) {
    for {
        head := q.head.Load()
        tail := q.tail.Load()
        next := head.next.Load()
        
        if head == q.head.Load() {
            if head == tail {
                if next == nil {
                    return 0, false  // 空队列
                }
                q.tail.CompareAndSwap(tail, next)
            } else {
                v := next.value
                if q.head.CompareAndSwap(head, next) {
                    return v, true
                }
            }
        }
    }
}